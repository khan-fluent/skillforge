import { Router } from "express";
import pool from "../db/index.js";

const router = Router();

// Upsert a proficiency.
router.post("/", async (req, res, next) => {
  try {
    const { person_id, skill_id, level, source, notes } = req.body;
    if (!person_id || !skill_id || !level) {
      return res.status(400).json({ error: "person_id, skill_id, level required" });
    }
    if (level < 1 || level > 5) return res.status(400).json({ error: "level must be 1-5" });

    const { rows } = await pool.query(
      `INSERT INTO proficiencies (person_id, skill_id, level, source, notes)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (person_id, skill_id)
       DO UPDATE SET level = EXCLUDED.level,
                     source = EXCLUDED.source,
                     notes = EXCLUDED.notes,
                     updated_at = NOW()
       RETURNING *`,
      [person_id, skill_id, level, source || "self", notes]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

router.delete("/:person_id/:skill_id", async (req, res, next) => {
  try {
    await pool.query(
      "DELETE FROM proficiencies WHERE person_id = $1 AND skill_id = $2",
      [req.params.person_id, req.params.skill_id]
    );
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
