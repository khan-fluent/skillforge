import { query } from "../db/index.js";

/**
 * Comprehensive JSON snapshot of a team's entire knowledge state.
 * Fed to the LLM as system context so it can ground answers in real data.
 *
 * Includes: people, skills, proficiencies, certifications, bus-factor analysis,
 * domains, domain proficiencies, upskill plans, and KB documents.
 */
export async function buildSnapshot(teamId) {
  const [
    team, people, skills, profs, certs,
    domains, domainProfs,
    upskillPlans, upskillSteps,
    kbDocs,
  ] = await Promise.all([
    query("SELECT id, name FROM teams WHERE id = $1", [teamId]),
    query("SELECT id, name, role, job_title FROM users WHERE team_id = $1 AND accepted_at IS NOT NULL ORDER BY name", [teamId]),
    query("SELECT id, name, domain, deprecated FROM skills WHERE team_id = $1 ORDER BY domain, name", [teamId]),
    query(
      `SELECT pr.user_id, pr.skill_id, pr.level
       FROM proficiencies pr JOIN users u ON u.id = pr.user_id
       WHERE u.team_id = $1`,
      [teamId]
    ),
    query(
      `SELECT c.user_id, c.name, c.issuer, c.expires_on,
              CASE
                WHEN c.expires_on IS NULL THEN 'no_expiry'
                WHEN c.expires_on < CURRENT_DATE THEN 'expired'
                WHEN c.expires_on < CURRENT_DATE + INTERVAL '90 days' THEN 'expiring_soon'
                ELSE 'valid'
              END AS status
       FROM certifications c JOIN users u ON u.id = c.user_id
       WHERE u.team_id = $1`,
      [teamId]
    ),
    // Domains
    query("SELECT id, name, category, description FROM domains WHERE team_id = $1 ORDER BY category, name", [teamId]),
    query(
      `SELECT dp.user_id, dp.domain_id, dp.level
       FROM domain_proficiencies dp JOIN domains d ON d.id = dp.domain_id
       WHERE d.team_id = $1`,
      [teamId]
    ),
    // Upskill plans
    query(
      `SELECT p.id, p.title, p.summary, p.status, u.name AS user_name, s.name AS skill_name,
              cb.name AS created_by_name
       FROM upskill_plans p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN skills s ON s.id = p.skill_id
       LEFT JOIN users cb ON cb.id = p.created_by
       WHERE p.team_id = $1 AND p.status IN ('active', 'completed')
       ORDER BY p.updated_at DESC`,
      [teamId]
    ),
    query(
      `SELECT st.plan_id, st.title, st.completed
       FROM upskill_steps st
       JOIN upskill_plans p ON p.id = st.plan_id
       WHERE p.team_id = $1 AND p.status IN ('active', 'completed')
       ORDER BY st.sort_order`,
      [teamId]
    ),
    // KB docs (titles + excerpts + linked skills)
    query(
      `SELECT d.title, LEFT(d.content, 500) AS excerpt,
              ARRAY_REMOVE(ARRAY_AGG(s.name), NULL) AS skill_names
       FROM kb_documents d
       LEFT JOIN kb_document_skills ds ON ds.document_id = d.id
       LEFT JOIN skills s ON s.id = ds.skill_id
       WHERE d.team_id = $1
       GROUP BY d.id
       ORDER BY d.updated_at DESC
       LIMIT 20`,
      [teamId]
    ),
  ]);

  // Build people with skills + certs + domain proficiencies
  const peopleById = Object.fromEntries(
    people.rows.map((p) => [p.id, { ...p, skills: [], certifications: [], domains: [] }])
  );
  const skillsById = Object.fromEntries(skills.rows.map((s) => [s.id, s]));
  const domainsById = Object.fromEntries(domains.rows.map((d) => [d.id, d]));

  for (const pr of profs.rows) {
    const person = peopleById[pr.user_id];
    const skill = skillsById[pr.skill_id];
    if (person && skill) person.skills.push({ name: skill.name, domain: skill.domain, level: pr.level });
  }
  for (const c of certs.rows) {
    if (peopleById[c.user_id]) {
      peopleById[c.user_id].certifications.push({
        name: c.name, issuer: c.issuer, expires_on: c.expires_on, status: c.status,
      });
    }
  }
  for (const dp of domainProfs.rows) {
    const person = peopleById[dp.user_id];
    const domain = domainsById[dp.domain_id];
    if (person && domain) person.domains.push({ name: domain.name, category: domain.category, level: dp.level });
  }

  // Skill bus-factor analysis
  const skillRisk = skills.rows.map((s) => {
    const owners = profs.rows
      .filter((pr) => pr.skill_id === s.id && pr.level >= 4)
      .map((pr) => peopleById[pr.user_id]?.name)
      .filter(Boolean);
    return { skill: s.name, domain: s.domain, bus_factor: owners.length, proficient: owners };
  });

  // Domain bus-factor analysis
  const domainRisk = domains.rows.map((d) => {
    const owners = domainProfs.rows
      .filter((dp) => dp.domain_id === d.id && dp.level >= 4)
      .map((dp) => peopleById[dp.user_id]?.name)
      .filter(Boolean);
    return { domain: d.name, category: d.category, bus_factor: owners.length, proficient: owners };
  });

  // Group upskill steps by plan
  const stepsMap = {};
  for (const st of upskillSteps.rows) {
    if (!stepsMap[st.plan_id]) stepsMap[st.plan_id] = [];
    stepsMap[st.plan_id].push({ title: st.title, completed: st.completed });
  }

  const upskillSnapshot = upskillPlans.rows.map((p) => ({
    title: p.title,
    summary: p.summary,
    status: p.status,
    for_user: p.user_name,
    skill: p.skill_name,
    assigned_by: p.created_by_name,
    steps: stepsMap[p.id] || [],
    progress: stepsMap[p.id]
      ? `${stepsMap[p.id].filter((s) => s.completed).length}/${stepsMap[p.id].length}`
      : "0/0",
  }));

  return {
    team_name: team.rows[0]?.name,
    team_size: people.rows.length,
    skill_count: skills.rows.length,
    domain_count: domains.rows.length,
    people: Object.values(peopleById),
    skill_risk: skillRisk,
    domain_risk: domainRisk,
    upskill_plans: upskillSnapshot,
    knowledge_base: kbDocs.rows.map((d) => ({
      title: d.title, excerpt: d.excerpt, skills: d.skill_names,
    })),
  };
}
