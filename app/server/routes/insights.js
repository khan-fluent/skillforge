import { Router } from "express";
import { query } from "../db/index.js";
import requireAuth from "../middleware/auth.js";

const router = Router();

/**
 * GET /api/insights
 *
 * Deterministic insights engine — no LLM call. Computes actionable
 * suggestions from gaps, proficiency matrix, and certification data.
 * Returns up to 6 ranked insights.
 */
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const teamId = req.user.team_id;
    const insights = [];

    // 1. Gap closers — people close to level 4 on critical/at-risk skills
    const { rows: gapCandidates } = await query(
      `SELECT s.id AS skill_id, s.name AS skill_name, s.domain,
              u.id AS user_id, u.name AS user_name,
              pr.level,
              COUNT(*) FILTER (WHERE pr2.level >= 4) OVER (PARTITION BY s.id)::int AS bus_factor
       FROM skills s
       JOIN proficiencies pr ON pr.skill_id = s.id
       JOIN users u ON u.id = pr.user_id AND u.team_id = s.team_id
       LEFT JOIN proficiencies pr2 ON pr2.skill_id = s.id
       WHERE s.team_id = $1 AND pr.level BETWEEN 2 AND 3
       ORDER BY pr.level DESC, s.name`,
      [teamId]
    );

    for (const c of gapCandidates) {
      if (c.bus_factor <= 1 && insights.length < 8) {
        const levelsToGo = 4 - c.level;
        insights.push({
          type: "upskill",
          priority: c.bus_factor === 0 ? "critical" : "high",
          title: `${c.user_name} should level up ${c.skill_name}`,
          description: `Currently at level ${c.level}/5 — ${levelsToGo === 1 ? "one level" : `${levelsToGo} levels`} away from proficient. This would increase bus factor from ${c.bus_factor} to ${c.bus_factor + 1}.`,
          action: `Create an upskilling plan for ${c.user_name} to improve their ${c.skill_name} proficiency from level ${c.level} to level 4+. Include specific learning resources, practice exercises, and a timeline.`,
          skill_id: c.skill_id,
          user_id: c.user_id,
        });
      }
    }

    // 2. Unowned critical skills — nobody has any proficiency at all
    const { rows: unowned } = await query(
      `SELECT s.id, s.name, s.domain
       FROM skills s
       LEFT JOIN proficiencies pr ON pr.skill_id = s.id
       WHERE s.team_id = $1
       GROUP BY s.id
       HAVING COUNT(pr.id) = 0`,
      [teamId]
    );

    for (const s of unowned) {
      insights.push({
        type: "gap",
        priority: "critical",
        title: `${s.name} has no team coverage`,
        description: `Nobody on the team has rated themselves on this skill. Consider assigning it or removing it if no longer relevant.`,
        action: `Analyze the skill "${s.name}" (${s.domain}) for our team. Who should learn it? What's the fastest path to coverage? Suggest a plan.`,
        skill_id: s.id,
      });
    }

    // 3. Expiring certifications
    const { rows: expiringCerts } = await query(
      `SELECT c.name AS cert_name, u.name AS user_name, c.expires_on,
              CASE WHEN c.expires_on < CURRENT_DATE THEN 'expired' ELSE 'expiring' END AS urgency
       FROM certifications c
       JOIN users u ON u.id = c.user_id AND u.team_id = $1
       WHERE c.expires_on IS NOT NULL
         AND c.expires_on < CURRENT_DATE + INTERVAL '90 days'
       ORDER BY c.expires_on`,
      [teamId]
    );

    for (const c of expiringCerts.slice(0, 2)) {
      insights.push({
        type: "cert",
        priority: c.urgency === "expired" ? "critical" : "medium",
        title: `${c.user_name}'s ${c.cert_name} is ${c.urgency === "expired" ? "expired" : "expiring soon"}`,
        description: `${c.urgency === "expired" ? "Expired" : `Expires ${c.expires_on}`}. Schedule a renewal.`,
        action: `Help ${c.user_name} plan their ${c.cert_name} certification renewal. Include study resources, exam prep timeline, and booking steps.`,
      });
    }

    // 4. Single points of failure — skills where one person carries all the weight
    const { rows: spofs } = await query(
      `SELECT s.name AS skill_name, u.name AS owner_name,
              COUNT(*) FILTER (WHERE pr.level >= 4)::int AS bus_factor,
              COUNT(pr.id)::int AS total_known
       FROM skills s
       JOIN proficiencies pr ON pr.skill_id = s.id
       JOIN users u ON u.id = pr.user_id AND pr.level >= 4
       WHERE s.team_id = $1
       GROUP BY s.id, u.id, u.name, s.name
       HAVING COUNT(*) FILTER (WHERE pr.level >= 4) = 1`,
      [teamId]
    );

    // Only add a couple to avoid flooding
    for (const s of spofs.slice(0, 2)) {
      if (!insights.find((i) => i.title.includes(s.skill_name))) {
        insights.push({
          type: "risk",
          priority: "medium",
          title: `${s.skill_name} depends entirely on ${s.owner_name}`,
          description: `If ${s.owner_name} is unavailable, the team loses this capability. Consider cross-training.`,
          action: `Create a cross-training plan for ${s.skill_name}. ${s.owner_name} is the only expert — identify who else on the team should learn it and how.`,
        });
      }
    }

    // Sort by priority, cap at 6
    const priorityOrder = { critical: 0, high: 1, medium: 2 };
    insights.sort((a, b) => (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3));

    res.json(insights.slice(0, 6));
  } catch (e) { next(e); }
});

export default router;
