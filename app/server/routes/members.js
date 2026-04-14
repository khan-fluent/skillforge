import { Router } from "express";
import { query } from "../db/index.js";
import requireAuth, { requireAdmin } from "../middleware/auth.js";
import { newInviteToken } from "./auth.js";

const router = Router();

// Anyone in the team can list members.
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT u.id, u.name, u.email, u.role, u.job_title, u.accepted_at, u.invited_at,
              COUNT(pr.id)::int                AS skill_count,
              COALESCE(AVG(pr.level), 0)::float AS avg_level
       FROM users u
       LEFT JOIN proficiencies pr ON pr.user_id = u.id
       WHERE u.team_id = $1
       GROUP BY u.id
       ORDER BY u.role DESC, u.name`,
      [req.user.team_id]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// Detail view: skills + certs included.
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const { rows: users } = await query(
      "SELECT id, team_id, name, email, role, job_title, accepted_at FROM users WHERE id = $1 AND team_id = $2",
      [req.params.id, req.user.team_id]
    );
    if (!users.length) return res.status(404).json({ error: "not found" });

    const { rows: skills } = await query(
      `SELECT s.id, s.name, s.domain, pr.level, pr.notes
       FROM proficiencies pr
       JOIN skills s ON s.id = pr.skill_id
       WHERE pr.user_id = $1
       ORDER BY pr.level DESC, s.name`,
      [req.params.id]
    );
    const { rows: certs } = await query(
      "SELECT * FROM certifications WHERE user_id = $1 ORDER BY expires_on NULLS LAST",
      [req.params.id]
    );

    res.json({ ...users[0], skills, certifications: certs });
  } catch (e) { next(e); }
});

// Admin creates a new member. They get an invite token but no password yet.
router.post("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { name, email, role, job_title } = req.body;
    if (!name || !email) return res.status(400).json({ error: "name and email required" });
    const finalRole = role === "admin" ? "admin" : "member";

    const existing = await query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
    if (existing.rows.length > 0) return res.status(409).json({ error: "Email already in use" });

    const token = newInviteToken();
    const { rows } = await query(
      `INSERT INTO users (team_id, name, email, role, job_title, invite_token, invited_at, invite_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW() + INTERVAL '72 hours')
       RETURNING id, name, email, role, job_title, invite_token, invited_at, invite_expires_at`,
      [req.user.team_id, name, email.toLowerCase(), finalRole, job_title || null, token]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

// Update member: admin can edit anyone in the team; non-admin can only edit themselves.
router.put("/:id", requireAuth, async (req, res, next) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    const isSelf = targetId === req.user.id;
    if (!isSelf && req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });

    const { name, job_title, role } = req.body;
    // Only admin may change role; ignore otherwise.
    const newRole = req.user.role === "admin" && (role === "admin" || role === "member") ? role : null;

    const { rows } = await query(
      `UPDATE users
         SET name = COALESCE($1, name),
             job_title = COALESCE($2, job_title),
             role = COALESCE($3, role)
       WHERE id = $4 AND team_id = $5
       RETURNING id, name, email, role, job_title`,
      [name || null, job_title ?? null, newRole, targetId, req.user.team_id]
    );
    if (!rows.length) return res.status(404).json({ error: "not found" });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    if (parseInt(req.params.id, 10) === req.user.id) {
      return res.status(400).json({ error: "Admins cannot delete themselves" });
    }
    await query("DELETE FROM users WHERE id = $1 AND team_id = $2", [req.params.id, req.user.team_id]);
    res.status(204).end();
  } catch (e) { next(e); }
});

// Re-issue an invite token (for admin to re-share if the link was lost).
router.post("/:id/reinvite", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const token = newInviteToken();
    const { rows } = await query(
      `UPDATE users
         SET invite_token = $1, invited_at = NOW(), invite_expires_at = NOW() + INTERVAL '72 hours',
             accepted_at = NULL, password_hash = NULL
       WHERE id = $2 AND team_id = $3
       RETURNING id, name, email, invite_token, invite_expires_at`,
      [token, req.params.id, req.user.team_id]
    );
    if (!rows.length) return res.status(404).json({ error: "not found" });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

export default router;
