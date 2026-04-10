import { query } from "../db/index.js";

// Compact JSON snapshot of one team's skill state for Claude. Always team-scoped.
export async function buildSnapshot(teamId) {
  const [team, people, skills, profs, certs, kbDocs] = await Promise.all([
    query("SELECT id, name FROM teams WHERE id = $1", [teamId]),
    query("SELECT id, name, role, job_title FROM users WHERE team_id = $1 ORDER BY name", [teamId]),
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

  const peopleById = Object.fromEntries(
    people.rows.map((p) => [p.id, { ...p, skills: [], certifications: [] }])
  );
  const skillsById = Object.fromEntries(skills.rows.map((s) => [s.id, s]));

  for (const pr of profs.rows) {
    const person = peopleById[pr.user_id];
    const skill = skillsById[pr.skill_id];
    if (person && skill) person.skills.push({ name: skill.name, domain: skill.domain, level: pr.level });
  }
  for (const c of certs.rows) {
    if (peopleById[c.user_id]) {
      peopleById[c.user_id].certifications.push({
        name: c.name,
        issuer: c.issuer,
        expires_on: c.expires_on,
        status: c.status,
      });
    }
  }

  const skillRisk = skills.rows.map((s) => {
    const owners = profs.rows
      .filter((pr) => pr.skill_id === s.id && pr.level >= 4)
      .map((pr) => peopleById[pr.user_id]?.name)
      .filter(Boolean);
    return { skill: s.name, domain: s.domain, bus_factor: owners.length, proficient: owners };
  });

  return {
    team_name: team.rows[0]?.name,
    team_size: people.rows.length,
    skill_count: skills.rows.length,
    people: Object.values(peopleById),
    skill_risk: skillRisk,
    knowledge_base: kbDocs.rows.map((d) => ({
      title: d.title,
      excerpt: d.excerpt,
      skills: d.skill_names,
    })),
  };
}
