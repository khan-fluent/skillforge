import { Router } from "express";
import pool from "../db/index.js";

const router = Router();

// Returns a structure friendly for heatmap rendering:
// { people: [...], skills: [...], cells: { "personId:skillId": level } }
router.get("/", async (_req, res, next) => {
  try {
    const [{ rows: people }, { rows: skills }, { rows: profs }] = await Promise.all([
      pool.query("SELECT id, name, role, team FROM people ORDER BY name"),
      pool.query("SELECT id, name, domain, deprecated FROM skills ORDER BY domain, name"),
      pool.query("SELECT person_id, skill_id, level FROM proficiencies"),
    ]);

    const cells = {};
    for (const p of profs) cells[`${p.person_id}:${p.skill_id}`] = p.level;

    res.json({ people, skills, cells });
  } catch (e) { next(e); }
});

export default router;
