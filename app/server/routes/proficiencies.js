import { Router } from "express";
import { query } from "../db/index.js";
import requireAuth from "../middleware/auth.js";

const router = Router();

// Upsert. Members can only edit their own; admins can pass user_id to edit anyone in the team.
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { skill_id, level, notes } = req.body;
    let userId = req.user.id;

    if (req.body.user_id && req.body.user_id !== req.user.id) {
      if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
      // Confirm target lives in same team.
      const target = await query("SELECT id FROM users WHERE id = $1 AND team_id = $2", [req.body.user_id, req.user.team_id]);
      if (!target.rows.length) return res.status(404).json({ error: "user not found" });
      userId = req.body.user_id;
    }

    if (!skill_id || !level) return res.status(400).json({ error: "skill_id and level required" });
    if (level < 1 || level > 5) return res.status(400).json({ error: "level must be 1-5" });

    // Make sure the skill is in the same team.
    const skill = await query("SELECT id FROM skills WHERE id = $1 AND team_id = $2", [skill_id, req.user.team_id]);
    if (!skill.rows.length) return res.status(404).json({ error: "skill not found" });

    const source = userId === req.user.id ? "self" : "lead";
    const { rows } = await query(
      `INSERT INTO proficiencies (user_id, skill_id, level, source, notes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, skill_id) DO UPDATE SET
         level = EXCLUDED.level,
         source = EXCLUDED.source,
         notes = EXCLUDED.notes,
         updated_at = NOW()
       RETURNING *`,
      [userId, skill_id, level, source, notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

router.delete("/:user_id/:skill_id", requireAuth, async (req, res, next) => {
  try {
    const targetId = parseInt(req.params.user_id, 10);
    if (targetId !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    await query(
      `DELETE FROM proficiencies pr
       USING users u
       WHERE pr.user_id = $1 AND pr.skill_id = $2 AND pr.user_id = u.id AND u.team_id = $3`,
      [targetId, req.params.skill_id, req.user.team_id]
    );
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
