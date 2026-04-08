import { Router } from "express";
import pool from "../db/index.js";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*, p.name AS person_name,
              CASE
                WHEN c.expires_on IS NULL THEN 'no_expiry'
                WHEN c.expires_on < CURRENT_DATE THEN 'expired'
                WHEN c.expires_on < CURRENT_DATE + INTERVAL '90 days' THEN 'expiring_soon'
                ELSE 'valid'
              END AS status
       FROM certifications c
       JOIN people p ON p.id = c.person_id
       ORDER BY c.expires_on NULLS LAST`
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.post("/", async (req, res, next) => {
  try {
    const { person_id, name, issuer, issued_on, expires_on, credential_url } = req.body;
    if (!person_id || !name) return res.status(400).json({ error: "person_id and name required" });
    const { rows } = await pool.query(
      `INSERT INTO certifications (person_id, name, issuer, issued_on, expires_on, credential_url)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [person_id, name, issuer, issued_on, expires_on, credential_url]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await pool.query("DELETE FROM certifications WHERE id = $1", [req.params.id]);
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
