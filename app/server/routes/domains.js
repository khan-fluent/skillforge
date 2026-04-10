import { Router } from "express";
import { query } from "../db/index.js";
import requireAuth, { requireAdmin } from "../middleware/auth.js";

const router = Router();

// List all domains with proficiency stats
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT d.*,
              COUNT(dp.id)::int                          AS people_count,
              COALESCE(AVG(dp.level), 0)::float          AS avg_level,
              COUNT(*) FILTER (WHERE dp.level >= 4)::int AS proficient_count
       FROM domains d
       LEFT JOIN domain_proficiencies dp ON dp.domain_id = d.id
       WHERE d.team_id = $1
       GROUP BY d.id
       ORDER BY d.category, d.name`,
      [req.user.team_id]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// Create / upsert a domain
router.post("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { name, category, description } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });
    const { rows } = await query(
      `INSERT INTO domains (team_id, name, category, description)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (team_id, name) DO UPDATE SET
         category = EXCLUDED.category,
         description = COALESCE(EXCLUDED.description, domains.description)
       RETURNING *`,
      [req.user.team_id, name, category || "general", description || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

// Delete a domain
router.delete("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await query("DELETE FROM domains WHERE id = $1 AND team_id = $2", [req.params.id, req.user.team_id]);
    res.status(204).end();
  } catch (e) { next(e); }
});

// Set a user's proficiency in a domain
router.post("/proficiencies", requireAuth, async (req, res, next) => {
  try {
    const { user_id, domain_id, level, notes } = req.body;
    if (!domain_id || !level) return res.status(400).json({ error: "domain_id and level required" });

    const targetUserId = user_id || req.user.id;

    // Verify domain belongs to team
    const { rows: domainRows } = await query(
      "SELECT id FROM domains WHERE id = $1 AND team_id = $2",
      [domain_id, req.user.team_id]
    );
    if (!domainRows.length) return res.status(404).json({ error: "Domain not found" });

    const { rows } = await query(
      `INSERT INTO domain_proficiencies (user_id, domain_id, level, notes, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id, domain_id) DO UPDATE SET
         level = EXCLUDED.level,
         notes = COALESCE(EXCLUDED.notes, domain_proficiencies.notes),
         updated_at = NOW()
       RETURNING *`,
      [targetUserId, domain_id, level, notes || null]
    );
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// Bus-factor / gap analysis for domains (same logic as skills gaps)
router.get("/gaps", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT d.id, d.name, d.category, d.description,
              COUNT(*) FILTER (WHERE dp.level >= 4)::int AS bus_factor,
              COUNT(dp.id)::int                          AS total_known,
              ARRAY_REMOVE(
                ARRAY_AGG(u.name ORDER BY dp.level DESC) FILTER (WHERE dp.level >= 4),
                NULL
              ) AS proficient_people
       FROM domains d
       LEFT JOIN domain_proficiencies dp ON dp.domain_id = d.id
       LEFT JOIN users u                 ON u.id = dp.user_id AND u.team_id = d.team_id
       WHERE d.team_id = $1
       GROUP BY d.id
       ORDER BY bus_factor ASC, d.category, d.name`,
      [req.user.team_id]
    );
    const summary = {
      critical: rows.filter((r) => r.bus_factor === 0).length,
      high_risk: rows.filter((r) => r.bus_factor === 1).length,
      healthy: rows.filter((r) => r.bus_factor >= 2).length,
      total: rows.length,
    };
    res.json({ summary, domains: rows });
  } catch (e) { next(e); }
});

// Matrix view — all users x all domains with levels
router.get("/matrix", requireAuth, async (req, res, next) => {
  try {
    const [{ rows: members }, { rows: domains }, { rows: profs }] = await Promise.all([
      query("SELECT id, name, job_title FROM users WHERE team_id = $1 AND accepted_at IS NOT NULL ORDER BY name", [req.user.team_id]),
      query("SELECT id, name, category FROM domains WHERE team_id = $1 ORDER BY category, name", [req.user.team_id]),
      query(
        `SELECT dp.user_id, dp.domain_id, dp.level
         FROM domain_proficiencies dp
         JOIN domains d ON d.id = dp.domain_id
         WHERE d.team_id = $1`,
        [req.user.team_id]
      ),
    ]);

    const profMap = {};
    for (const p of profs) {
      profMap[`${p.user_id}-${p.domain_id}`] = p.level;
    }

    res.json({ members, domains, proficiencies: profMap });
  } catch (e) { next(e); }
});

export default router;
