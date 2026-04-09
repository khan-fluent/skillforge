import { Router } from "express";
import { query } from "../db/index.js";
import requireAuth, { requireAdmin } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const { rows } = await query("SELECT id, name, created_at FROM teams WHERE id = $1", [req.user.team_id]);
  res.json(rows[0]);
});

router.put("/", requireAuth, requireAdmin, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  const { rows } = await query(
    "UPDATE teams SET name = $1 WHERE id = $2 RETURNING id, name, created_at",
    [name, req.user.team_id]
  );
  res.json(rows[0]);
});

export default router;
