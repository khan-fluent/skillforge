import pool from "../db/index.js";

// Builds a compact JSON snapshot of the team's skill state to feed to Claude.
// Kept small enough to ship as system context on every chat turn.
export async function buildSnapshot() {
  const [people, skills, profs, certs] = await Promise.all([
    pool.query("SELECT id, name, role, team FROM people ORDER BY name"),
    pool.query("SELECT id, name, domain, deprecated FROM skills ORDER BY domain, name"),
    pool.query("SELECT person_id, skill_id, level FROM proficiencies"),
    pool.query(
      `SELECT person_id, name, issuer, expires_on,
              CASE
                WHEN expires_on IS NULL THEN 'no_expiry'
                WHEN expires_on < CURRENT_DATE THEN 'expired'
                WHEN expires_on < CURRENT_DATE + INTERVAL '90 days' THEN 'expiring_soon'
                ELSE 'valid'
              END AS status
       FROM certifications`
    ),
  ]);

  const peopleById = Object.fromEntries(people.rows.map((p) => [p.id, { ...p, skills: [], certifications: [] }]));
  const skillsById = Object.fromEntries(skills.rows.map((s) => [s.id, s]));

  for (const pr of profs.rows) {
    const person = peopleById[pr.person_id];
    const skill = skillsById[pr.skill_id];
    if (person && skill) {
      person.skills.push({ name: skill.name, domain: skill.domain, level: pr.level });
    }
  }
  for (const c of certs.rows) {
    if (peopleById[c.person_id]) {
      peopleById[c.person_id].certifications.push({
        name: c.name,
        issuer: c.issuer,
        expires_on: c.expires_on,
        status: c.status,
      });
    }
  }

  // Bus-factor (proficient = level >= 4)
  const skillRisk = skills.rows.map((s) => {
    const owners = profs.rows
      .filter((pr) => pr.skill_id === s.id && pr.level >= 4)
      .map((pr) => peopleById[pr.person_id]?.name)
      .filter(Boolean);
    return { skill: s.name, domain: s.domain, bus_factor: owners.length, proficient: owners };
  });

  return {
    team_size: people.rows.length,
    skill_count: skills.rows.length,
    people: Object.values(peopleById),
    skill_risk: skillRisk,
  };
}
