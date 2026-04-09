import { Router } from "express";
import { query } from "../db/index.js";
import requireAuth, { requireAdmin } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT s.*,
              COUNT(pr.id)::int                          AS people_count,
              COALESCE(AVG(pr.level), 0)::float          AS avg_level,
              COUNT(*) FILTER (WHERE pr.level >= 4)::int AS proficient_count
       FROM skills s
       LEFT JOIN proficiencies pr ON pr.skill_id = s.id
       WHERE s.team_id = $1
       GROUP BY s.id
       ORDER BY s.domain, s.name`,
      [req.user.team_id]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// Any team member can suggest a new skill; admins can also delete.
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { name, domain, description, deprecated } = req.body;
    if (!name || !domain) return res.status(400).json({ error: "name and domain required" });
    const { rows } = await query(
      `INSERT INTO skills (team_id, name, domain, description, deprecated)
       VALUES ($1, $2, $3, $4, COALESCE($5, false))
       ON CONFLICT (team_id, name) DO UPDATE SET
         domain = EXCLUDED.domain,
         description = COALESCE(EXCLUDED.description, skills.description)
       RETURNING *`,
      [req.user.team_id, name, domain, description || null, deprecated]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await query("DELETE FROM skills WHERE id = $1 AND team_id = $2", [req.params.id, req.user.team_id]);
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
