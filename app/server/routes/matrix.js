import { Router } from "express";
import { query } from "../db/index.js";
import requireAuth from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const [{ rows: people }, { rows: skills }, { rows: profs }] = await Promise.all([
      query("SELECT id, name, role, job_title FROM users WHERE team_id = $1 ORDER BY name", [req.user.team_id]),
      query("SELECT id, name, domain, deprecated FROM skills WHERE team_id = $1 ORDER BY domain, name", [req.user.team_id]),
      query(
        `SELECT pr.user_id AS person_id, pr.skill_id, pr.level
         FROM proficiencies pr
         JOIN users u ON u.id = pr.user_id
         WHERE u.team_id = $1`,
        [req.user.team_id]
      ),
    ]);

    const cells = {};
    for (const p of profs) cells[`${p.person_id}:${p.skill_id}`] = p.level;

    res.json({ people, skills, cells });
  } catch (e) { next(e); }
});

export default router;
