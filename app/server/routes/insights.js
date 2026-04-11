import { Router } from "express";
import { query } from "../db/index.js";
import requireAuth from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const teamId = req.user.team_id;
    const insights = [];
    const seenSkills = new Set();
    const seenPeople = new Set();

    // 1. Critical gaps — skills where bus factor = 0, with upskill candidates
    const { rows: criticals } = await query(
      `SELECT s.id AS skill_id, s.name AS skill_name, s.domain,
              ARRAY_AGG(u.name ORDER BY pr.level DESC) AS candidates,
              ARRAY_AGG(u.id ORDER BY pr.level DESC) AS candidate_ids,
              ARRAY_AGG(pr.level ORDER BY pr.level DESC) AS levels
       FROM skills s
       JOIN proficiencies pr ON pr.skill_id = s.id
       JOIN users u ON u.id = pr.user_id AND u.team_id = s.team_id
       WHERE s.team_id = $1
         AND NOT EXISTS (
           SELECT 1 FROM proficiencies p2
           WHERE p2.skill_id = s.id AND p2.level >= 4
         )
       GROUP BY s.id`,
      [teamId]
    );

    for (const c of criticals) {
      const best = c.candidates[0];
      const bestLevel = c.levels[0];
      seenSkills.add(c.skill_id);
      insights.push({
        type: "gap",
        priority: "critical",
        title: `No expert in ${c.skill_name}`,
        description: `Bus factor 0. ${best} is closest at level ${bestLevel}/5 \u2014 ${4 - bestLevel === 1 ? "one level" : `${4 - bestLevel} levels`} from proficient.`,
        action: `Create an upskilling plan to close the ${c.skill_name} gap. ${best} is at level ${bestLevel} \u2014 what's the fastest path to level 4+? Include resources and timeline.`,
        skill_id: c.skill_id,
        user_id: c.candidate_ids[0],
        user_name: best,
        skill_name: c.skill_name,
        current_level: bestLevel,
      });
    }

    // 2. Best upskill candidates — people at level 3 on at-risk skills (bus factor 1), spread across people
    const { rows: upskillCandidates } = await query(
      `SELECT s.id AS skill_id, s.name AS skill_name, s.domain,
              u.id AS user_id, u.name AS user_name, pr.level,
              (SELECT ARRAY_AGG(u2.name) FROM proficiencies p2 JOIN users u2 ON u2.id = p2.user_id WHERE p2.skill_id = s.id AND p2.level >= 4) AS current_experts
       FROM skills s
       JOIN proficiencies pr ON pr.skill_id = s.id AND pr.level = 3
       JOIN users u ON u.id = pr.user_id AND u.team_id = s.team_id
       WHERE s.team_id = $1
         AND (SELECT COUNT(*) FROM proficiencies p2 WHERE p2.skill_id = s.id AND p2.level >= 4) = 1
       ORDER BY s.name`,
      [teamId]
    );

    for (const c of upskillCandidates) {
      if (seenSkills.has(c.skill_id) || seenPeople.has(c.user_id)) continue;
      seenSkills.add(c.skill_id);
      seenPeople.add(c.user_id);
      const expert = c.current_experts?.[0] || "one person";
      insights.push({
        type: "upskill",
        priority: "high",
        title: `${c.user_name} \u2192 ${c.skill_name} (level 3\u21924)`,
        description: `One level from proficient. Currently only ${expert} is the expert \u2014 adding ${c.user_name} would double coverage.`,
        action: `Create an upskilling plan for ${c.user_name} to reach level 4+ in ${c.skill_name}. They're at level 3. Include specific learning resources and a timeline.`,
        skill_id: c.skill_id,
        user_id: c.user_id,
        user_name: c.user_name,
        skill_name: c.skill_name,
        current_level: c.level,
      });
    }

    // 3. Domain gaps — domains with bus factor 0
    const { rows: domainGaps } = await query(
      `SELECT d.name AS domain_name, d.category,
              COUNT(dp.id)::int AS total_known,
              COUNT(*) FILTER (WHERE dp.level >= 4)::int AS bus_factor
       FROM domains d
       LEFT JOIN domain_proficiencies dp ON dp.domain_id = d.id
       WHERE d.team_id = $1
       GROUP BY d.id
       HAVING COUNT(*) FILTER (WHERE dp.level >= 4) = 0 AND COUNT(dp.id) > 0`,
      [teamId]
    );

    for (const d of domainGaps.slice(0, 2)) {
      insights.push({
        type: "domain",
        priority: "high",
        title: `No expert in ${d.domain_name} domain`,
        description: `${d.total_known} ${d.total_known === 1 ? "person knows" : "people know"} this domain but nobody is at level 4+.`,
        action: `Analyze the "${d.domain_name}" business domain for our team. Who is closest to expert-level? What would it take to get them there?`,
      });
    }

    // 4. Expiring certifications
    const { rows: expiringCerts } = await query(
      `SELECT c.name AS cert_name, u.name AS user_name, c.expires_on,
              CASE WHEN c.expires_on < CURRENT_DATE THEN 'expired' ELSE 'expiring' END AS urgency
       FROM certifications c
       JOIN users u ON u.id = c.user_id AND u.team_id = $1
       WHERE c.expires_on IS NOT NULL AND c.expires_on < CURRENT_DATE + INTERVAL '90 days'
       ORDER BY c.expires_on LIMIT 2`,
      [teamId]
    );

    for (const c of expiringCerts) {
      insights.push({
        type: "cert",
        priority: c.urgency === "expired" ? "critical" : "medium",
        title: `${c.user_name}'s ${c.cert_name} ${c.urgency === "expired" ? "has expired" : "expires soon"}`,
        description: c.urgency === "expired" ? "Expired. Schedule renewal." : `Expires ${c.expires_on}.`,
        action: `Help ${c.user_name} plan their ${c.cert_name} certification renewal. Include study resources and timeline.`,
      });
    }

    // 5. Team-level: weakest domain across team
    const { rows: weakDomains } = await query(
      `SELECT s.domain, ROUND(AVG(pr.level)::numeric, 1) AS avg_level,
              COUNT(DISTINCT s.id)::int AS skill_count
       FROM skills s
       JOIN proficiencies pr ON pr.skill_id = s.id
       WHERE s.team_id = $1
       GROUP BY s.domain
       HAVING AVG(pr.level) < 3.5
       ORDER BY AVG(pr.level) ASC LIMIT 1`,
      [teamId]
    );

    for (const d of weakDomains) {
      insights.push({
        type: "team",
        priority: "medium",
        title: `Team is weakest in ${d.domain}`,
        description: `Average proficiency is ${d.avg_level}/5 across ${d.skill_count} ${d.skill_count === 1 ? "skill" : "skills"}. Consider focused training.`,
        action: `Our team's weakest area is "${d.domain}" with an average of ${d.avg_level}/5. Suggest a team training plan to improve across all ${d.domain} skills.`,
      });
    }

    // Sort by priority, cap at 6
    const priorityOrder = { critical: 0, high: 1, medium: 2 };
    insights.sort((a, b) => (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3));

    res.json(insights.slice(0, 6));
  } catch (e) { next(e); }
});

export default router;
