import { Router } from "express";
import pool from "../db/index.js";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*,
              COUNT(pr.id)::int            AS skill_count,
              COALESCE(AVG(pr.level), 0)::float AS avg_level
       FROM people p
       LEFT JOIN proficiencies pr ON pr.person_id = p.id
       GROUP BY p.id
       ORDER BY p.name`
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.get("/:id", async (req, res, next) => {
  try {
    const { rows: people } = await pool.query("SELECT * FROM people WHERE id = $1", [req.params.id]);
    if (!people.length) return res.status(404).json({ error: "not found" });

    const { rows: skills } = await pool.query(
      `SELECT s.id, s.name, s.domain, pr.level, pr.source, pr.notes
       FROM proficiencies pr
       JOIN skills s ON s.id = pr.skill_id
       WHERE pr.person_id = $1
       ORDER BY pr.level DESC, s.name`,
      [req.params.id]
    );
    const { rows: certs } = await pool.query(
      "SELECT * FROM certifications WHERE person_id = $1 ORDER BY expires_on NULLS LAST",
      [req.params.id]
    );

    res.json({ ...people[0], skills, certifications: certs });
  } catch (e) { next(e); }
});

router.post("/", async (req, res, next) => {
  try {
    const { name, email, role, team, avatar_url, joined_at } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });
    const { rows } = await pool.query(
      `INSERT INTO people (name, email, role, team, avatar_url, joined_at)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name, email, role, team, avatar_url, joined_at]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

router.put("/:id", async (req, res, next) => {
  try {
    const { name, email, role, team, avatar_url, joined_at } = req.body;
    const { rows } = await pool.query(
      `UPDATE people SET name=$1, email=$2, role=$3, team=$4, avatar_url=$5, joined_at=$6
       WHERE id=$7 RETURNING *`,
      [name, email, role, team, avatar_url, joined_at, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "not found" });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await pool.query("DELETE FROM people WHERE id = $1", [req.params.id]);
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
