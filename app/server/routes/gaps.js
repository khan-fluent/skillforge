import { Router } from "express";
import pool from "../db/index.js";

const router = Router();

// Bus-factor + knowledge concentration analysis. A skill is "at risk" when
// it has 0 or 1 proficient (level >= 4) owners. Lower bus_factor = higher risk.
router.get("/", async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.name, s.domain, s.deprecated,
              COUNT(*) FILTER (WHERE pr.level >= 4)::int AS bus_factor,
              COUNT(pr.id)::int                          AS total_known,
              COALESCE(AVG(pr.level) FILTER (WHERE pr.level >= 4), 0)::float AS avg_expert_level,
              ARRAY_REMOVE(
                ARRAY_AGG(p.name ORDER BY pr.level DESC) FILTER (WHERE pr.level >= 4),
                NULL
              ) AS proficient_people
       FROM skills s
       LEFT JOIN proficiencies pr ON pr.skill_id = s.id
       LEFT JOIN people p         ON p.id = pr.person_id
       GROUP BY s.id
       ORDER BY bus_factor ASC, s.domain, s.name`
    );

    const summary = {
      critical: rows.filter((r) => r.bus_factor === 0).length,
      high_risk: rows.filter((r) => r.bus_factor === 1).length,
      healthy: rows.filter((r) => r.bus_factor >= 2).length,
      total: rows.length,
    };

    res.json({ summary, skills: rows });
  } catch (e) { next(e); }
});

export default router;
