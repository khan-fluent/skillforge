import jwt from "jsonwebtoken";
import { query } from "../db/index.js";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === "production") {
  console.error("FATAL: JWT_SECRET environment variable is required in production");
  process.exit(1);
}
const SECRET = JWT_SECRET || "dev-only-unsafe-secret-" + Math.random().toString(36);

export function generateToken(user) {
  return jwt.sign(
    { id: user.id, team_id: user.team_id, role: user.role },
    SECRET,
    { algorithm: "HS256", expiresIn: "7d" }
  );
}

// Verifies the JWT and loads a fresh copy of the user from the DB so role
// changes take effect immediately (within the next request after demotion).
export default async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    const decoded = jwt.verify(header.slice(7), SECRET, { algorithms: ["HS256"] });
    const { rows } = await query(
      "SELECT id, team_id, name, email, role, job_title, accepted_at FROM users WHERE id = $1",
      [decoded.id]
    );
    if (rows.length === 0) return res.status(401).json({ error: "User no longer exists" });
    req.user = rows[0];
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}
