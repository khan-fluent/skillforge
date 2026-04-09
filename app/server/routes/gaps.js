import { Router } from "express";
import { query } from "../db/index.js";
import requireAuth from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT s.id, s.name, s.domain, s.deprecated,
              COUNT(*) FILTER (WHERE pr.level >= 4)::int AS bus_factor,
              COUNT(pr.id)::int                          AS total_known,
              COALESCE(AVG(pr.level) FILTER (WHERE pr.level >= 4), 0)::float AS avg_expert_level,
              ARRAY_REMOVE(
                ARRAY_AGG(u.name ORDER BY pr.level DESC) FILTER (WHERE pr.level >= 4),
                NULL
              ) AS proficient_people
       FROM skills s
       LEFT JOIN proficiencies pr ON pr.skill_id = s.id
       LEFT JOIN users u          ON u.id = pr.user_id AND u.team_id = s.team_id
       WHERE s.team_id = $1
       GROUP BY s.id
       ORDER BY bus_factor ASC, s.domain, s.name`,
      [req.user.team_id]
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
