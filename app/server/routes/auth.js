import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import pool, { query } from "../db/index.js";
import requireAuth, { generateToken } from "../middleware/auth.js";

const router = Router();

// Sign up = create a brand new team. The signing-up user becomes the team admin.
// This is the only way new teams enter the system.
router.post("/signup", async (req, res) => {
  const { team_name, name, email, password } = req.body;
  if (!team_name || !name || !email || !password) {
    return res.status(400).json({ error: "team_name, name, email, password are required" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  const client = await pool.connect();
  try {
    const existing = await client.query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Email already registered" });
    }

    await client.query("BEGIN");
    const team = await client.query("INSERT INTO teams (name) VALUES ($1) RETURNING id, name", [team_name]);
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await client.query(
      `INSERT INTO users (team_id, name, email, password_hash, role, accepted_at)
       VALUES ($1, $2, $3, $4, 'admin', NOW())
       RETURNING id, team_id, name, email, role, job_title, accepted_at`,
      [team.rows[0].id, name, email.toLowerCase(), passwordHash]
    );
    await client.query("COMMIT");

    const token = generateToken(user.rows[0]);
    res.status(201).json({ token, user: user.rows[0], team: team.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Signup failed:", err.message);
    res.status(500).json({ error: "Signup failed" });
  } finally {
    client.release();
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }
  try {
    const { rows } = await query("SELECT * FROM users WHERE email = $1", [email.toLowerCase()]);
    if (!rows.length || !rows[0].password_hash) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const valid = await bcrypt.compare(password, rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: "Invalid email or password" });

    const { password_hash, invite_token, ...safeUser } = rows[0];
    res.json({ token: generateToken(rows[0]), user: safeUser });
  } catch (err) {
    console.error("Login failed:", err.message);
    res.status(500).json({ error: "Login failed" });
  }
});

// Members invited by an admin land here to set their password.
router.post("/accept", async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: "token and password required" });
  if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

  try {
    const { rows } = await query("SELECT * FROM users WHERE invite_token = $1", [token]);
    if (!rows.length) return res.status(404).json({ error: "Invalid or already-used invite" });

    const passwordHash = await bcrypt.hash(password, 10);
    const updated = await query(
      `UPDATE users
         SET password_hash = $1, invite_token = NULL, accepted_at = NOW()
       WHERE id = $2
       RETURNING id, team_id, name, email, role, job_title, accepted_at`,
      [passwordHash, rows[0].id]
    );
    res.json({ token: generateToken(updated.rows[0]), user: updated.rows[0] });
  } catch (err) {
    console.error("Accept invite failed:", err.message);
    res.status(500).json({ error: "Accept invite failed" });
  }
});

// Look up an invite by token (so the accept page can greet the invitee by name)
router.get("/invite/:token", async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT u.name, u.email, u.role, t.name AS team_name
       FROM users u JOIN teams t ON t.id = u.team_id
       WHERE u.invite_token = $1`,
      [req.params.token]
    );
    if (!rows.length) return res.status(404).json({ error: "Invite not found" });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: "Lookup failed" });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const team = await query("SELECT id, name FROM teams WHERE id = $1", [req.user.team_id]);
    res.json({ user: req.user, team: team.rows[0] });
  } catch {
    res.status(500).json({ error: "Failed to fetch session" });
  }
});

export default router;

// Used by members.js when an admin creates a new member.
export function newInviteToken() {
  return crypto.randomBytes(24).toString("hex");
}
