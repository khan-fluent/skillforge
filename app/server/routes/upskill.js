import { Router } from "express";
import { query } from "../db/index.js";
import { getLLM } from "../services/llm/index.js";
import { buildSnapshot } from "../services/snapshot.js";
import requireAuth from "../middleware/auth.js";

const router = Router();

// GET /upskill — list plans (admin: all, member: own only)
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const isAdmin = req.user.role === "admin";
    const { rows } = await query(
      `SELECT p.*, u.name AS user_name, s.name AS skill_name,
              COUNT(st.id)::int AS total_steps,
              COUNT(st.id) FILTER (WHERE st.completed)::int AS completed_steps,
              cb.name AS created_by_name
       FROM upskill_plans p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN skills s ON s.id = p.skill_id
       LEFT JOIN upskill_steps st ON st.plan_id = p.id
       LEFT JOIN users cb ON cb.id = p.created_by
       WHERE p.team_id = $1 ${isAdmin ? "" : "AND p.user_id = $2"}
       GROUP BY p.id, u.name, s.name, cb.name
       ORDER BY p.status ASC, p.updated_at DESC`,
      isAdmin ? [req.user.team_id] : [req.user.team_id, req.user.id]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// GET /upskill/:id — get plan with steps
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const isAdmin = req.user.role === "admin";
    const { rows: plans } = await query(
      `SELECT p.*, u.name AS user_name, s.name AS skill_name, cb.name AS created_by_name
       FROM upskill_plans p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN skills s ON s.id = p.skill_id
       LEFT JOIN users cb ON cb.id = p.created_by
       WHERE p.id = $1 AND p.team_id = $2 ${isAdmin ? "" : "AND p.user_id = $3"}`,
      isAdmin ? [req.params.id, req.user.team_id] : [req.params.id, req.user.team_id, req.user.id]
    );
    if (!plans.length) return res.status(404).json({ error: "Plan not found" });

    const { rows: steps } = await query(
      "SELECT * FROM upskill_steps WHERE plan_id = $1 ORDER BY sort_order, id",
      [req.params.id]
    );
    res.json({ ...plans[0], steps });
  } catch (e) { next(e); }
});

// POST /upskill — create plan manually
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { user_id, skill_id, title, summary, steps } = req.body;
    if (!title) return res.status(400).json({ error: "title required" });

    // Admin can assign to anyone, member can only create for self
    const targetUserId = req.user.role === "admin" && user_id ? user_id : req.user.id;

    const { rows } = await query(
      `INSERT INTO upskill_plans (team_id, user_id, skill_id, title, summary, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.team_id, targetUserId, skill_id || null, title, summary || null, req.user.id]
    );
    const plan = rows[0];

    if (Array.isArray(steps) && steps.length > 0) {
      for (let i = 0; i < steps.length; i++) {
        await query(
          "INSERT INTO upskill_steps (plan_id, sort_order, title, description) VALUES ($1, $2, $3, $4)",
          [plan.id, i, steps[i].title, steps[i].description || null]
        );
      }
    }

    res.status(201).json(plan);
  } catch (e) { next(e); }
});

// PUT /upskill/:id — update plan details
router.put("/:id", requireAuth, async (req, res, next) => {
  try {
    const { title, summary, status } = req.body;
    const isAdmin = req.user.role === "admin";
    const { rows } = await query(
      `UPDATE upskill_plans SET
         title = COALESCE($3, title),
         summary = COALESCE($4, summary),
         status = COALESCE($5, status),
         updated_at = NOW()
       WHERE id = $1 AND team_id = $2 ${isAdmin ? "" : "AND user_id = $6"}
       RETURNING *`,
      isAdmin
        ? [req.params.id, req.user.team_id, title, summary, status, null]
        : [req.params.id, req.user.team_id, title, summary, status, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Plan not found" });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// DELETE /upskill/:id
router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const isAdmin = req.user.role === "admin";
    await query(
      `DELETE FROM upskill_plans WHERE id = $1 AND team_id = $2 ${isAdmin ? "" : "AND user_id = $3"}`,
      isAdmin ? [req.params.id, req.user.team_id] : [req.params.id, req.user.team_id, req.user.id]
    );
    res.status(204).end();
  } catch (e) { next(e); }
});

// ─── Step CRUD ──────────────────────────────────────────────────────────────

// POST /upskill/:planId/steps — add a step
router.post("/:planId/steps", requireAuth, async (req, res, next) => {
  try {
    const { title, description } = req.body;
    if (!title) return res.status(400).json({ error: "title required" });
    // Get max sort_order
    const { rows: maxRow } = await query(
      "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM upskill_steps WHERE plan_id = $1",
      [req.params.planId]
    );
    const { rows } = await query(
      "INSERT INTO upskill_steps (plan_id, sort_order, title, description) VALUES ($1, $2, $3, $4) RETURNING *",
      [req.params.planId, maxRow[0].next_order, title, description || null]
    );
    await query("UPDATE upskill_plans SET updated_at = NOW() WHERE id = $1", [req.params.planId]);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

// PUT /upskill/steps/:id — update step (toggle, edit title/desc)
router.put("/steps/:id", requireAuth, async (req, res, next) => {
  try {
    const { title, description, completed } = req.body;
    const updates = [];
    const values = [req.params.id];
    let idx = 2;

    if (title !== undefined) { updates.push(`title = $${idx++}`); values.push(title); }
    if (description !== undefined) { updates.push(`description = $${idx++}`); values.push(description); }
    if (completed !== undefined) {
      updates.push(`completed = $${idx++}`);
      values.push(!!completed);
      updates.push(`completed_at = ${completed ? "NOW()" : "NULL"}`);
    }

    if (updates.length === 0) return res.status(400).json({ error: "Nothing to update" });

    const { rows } = await query(
      `UPDATE upskill_steps SET ${updates.join(", ")} WHERE id = $1 RETURNING *`,
      values
    );
    if (!rows.length) return res.status(404).json({ error: "Step not found" });
    await query("UPDATE upskill_plans SET updated_at = NOW() WHERE id = $1", [rows[0].plan_id]);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// DELETE /upskill/steps/:id
router.delete("/steps/:id", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query("DELETE FROM upskill_steps WHERE id = $1 RETURNING plan_id", [req.params.id]);
    if (rows.length) await query("UPDATE upskill_plans SET updated_at = NOW() WHERE id = $1", [rows[0].plan_id]);
    res.status(204).end();
  } catch (e) { next(e); }
});

// ─── AI Generation ──────────────────────────────────────────────────────────

router.post("/generate", requireAuth, async (req, res, next) => {
  try {
    const { user_name, skill_name, current_level, skill_id, user_id } = req.body;
    if (!user_name || !skill_name) return res.status(400).json({ error: "user_name and skill_name required" });

    const llm = await getLLM();
    const snapshot = await buildSnapshot(req.user.team_id);

    const text = await llm.chat({
      model: llm.fastModel,
      maxTokens: 2000,
      system: `You are a skill development expert. Generate a structured upskilling plan.

Return ONLY valid JSON:
{
  "title": "short plan title",
  "summary": "1-2 sentence overview",
  "steps": [
    { "title": "Step name", "description": "What to do, specific resources, expected outcome" }
  ]
}

Rules:
- 5-8 concrete, actionable steps
- Each step achievable in 1-2 weeks
- Include specific resources (courses, docs, exercises)
- Be practical, not generic
- Return ONLY JSON, no markdown`,
      messages: [{
        role: "user",
        content: `Create an upskilling plan for ${user_name} to improve ${skill_name} from level ${current_level || "unknown"} to level 4+ (Proficient).

Team skills: ${JSON.stringify(snapshot.skills?.map(s => s.name) || [])}`
      }],
    });

    let plan;
    try {
      plan = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) plan = JSON.parse(match[0]);
      else return res.status(502).json({ error: "AI returned invalid format. Try again." });
    }

    const targetUserId = req.user.role === "admin" && user_id ? user_id : req.user.id;

    const { rows } = await query(
      `INSERT INTO upskill_plans (team_id, user_id, skill_id, title, summary, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.team_id, targetUserId, skill_id || null, plan.title, plan.summary, req.user.id]
    );
    const saved = rows[0];

    const steps = [];
    if (Array.isArray(plan.steps)) {
      for (let i = 0; i < plan.steps.length; i++) {
        const { rows: stepRows } = await query(
          "INSERT INTO upskill_steps (plan_id, sort_order, title, description) VALUES ($1, $2, $3, $4) RETURNING *",
          [saved.id, i, plan.steps[i].title, plan.steps[i].description || null]
        );
        steps.push(stepRows[0]);
      }
    }

    res.status(201).json({ ...saved, steps });
  } catch (e) {
    console.error("Upskill generate failed:", e);
    next(e);
  }
});

export default router;
