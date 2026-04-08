import { Router } from "express";
import pool from "../db/index.js";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", db: "ok" });
  } catch (err) {
    res.status(503).json({ status: "degraded", db: "down", error: err.message });
  }
});

export default router;
