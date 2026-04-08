import { Router } from "express";
import pool from "../db/index.js";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.*,
              COUNT(pr.id)::int                                            AS people_count,
              COALESCE(AVG(pr.level), 0)::float                            AS avg_level,
              COUNT(*) FILTER (WHERE pr.level >= 4)::int                   AS proficient_count
       FROM skills s
       LEFT JOIN proficiencies pr ON pr.skill_id = s.id
       GROUP BY s.id
       ORDER BY s.domain, s.name`
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.post("/", async (req, res, next) => {
  try {
    const { name, domain, description, deprecated } = req.body;
    if (!name || !domain) return res.status(400).json({ error: "name and domain required" });
    const { rows } = await pool.query(
      `INSERT INTO skills (name, domain, description, deprecated)
       VALUES ($1,$2,$3,COALESCE($4,false)) RETURNING *`,
      [name, domain, description, deprecated]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await pool.query("DELETE FROM skills WHERE id = $1", [req.params.id]);
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
