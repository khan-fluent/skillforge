import { Router } from "express";
import { query } from "../db/index.js";
import requireAuth from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT c.*, u.name AS person_name, u.id AS user_id,
              CASE
                WHEN c.expires_on IS NULL THEN 'no_expiry'
                WHEN c.expires_on < CURRENT_DATE THEN 'expired'
                WHEN c.expires_on < CURRENT_DATE + INTERVAL '90 days' THEN 'expiring_soon'
                ELSE 'valid'
              END AS status
       FROM certifications c
       JOIN users u ON u.id = c.user_id
       WHERE u.team_id = $1
       ORDER BY c.expires_on NULLS LAST`,
      [req.user.team_id]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { name, issuer, issued_on, expires_on, credential_url } = req.body;
    let userId = req.user.id;
    if (req.body.user_id && req.body.user_id !== req.user.id) {
      if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
      const target = await query("SELECT id FROM users WHERE id = $1 AND team_id = $2", [req.body.user_id, req.user.team_id]);
      if (!target.rows.length) return res.status(404).json({ error: "user not found" });
      userId = req.body.user_id;
    }
    if (!name) return res.status(400).json({ error: "name required" });

    const { rows } = await query(
      `INSERT INTO certifications (user_id, name, issuer, issued_on, expires_on, credential_url)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [userId, name, issuer || null, issued_on || null, expires_on || null, credential_url || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    // Owner or admin can delete.
    const { rows } = await query(
      `SELECT c.id, c.user_id
       FROM certifications c
       JOIN users u ON u.id = c.user_id
       WHERE c.id = $1 AND u.team_id = $2`,
      [req.params.id, req.user.team_id]
    );
    if (!rows.length) return res.status(404).json({ error: "not found" });
    if (rows[0].user_id !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    await query("DELETE FROM certifications WHERE id = $1", [req.params.id]);
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
