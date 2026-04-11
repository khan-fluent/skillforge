import { Router } from "express";
import { query } from "../db/index.js";
import { getLLM } from "../services/llm/index.js";
import { buildSnapshot } from "../services/snapshot.js";
import requireAuth from "../middleware/auth.js";

const router = Router();

// GET /upskill — list plans for the team
router.get("/", requireAuth, async (req, res, next) => {
  try {
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
       WHERE p.team_id = $1
       GROUP BY p.id, u.name, s.name, cb.name
       ORDER BY p.status ASC, p.updated_at DESC`,
      [req.user.team_id]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// GET /upskill/:id — get plan with steps
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const { rows: plans } = await query(
      `SELECT p.*, u.name AS user_name, s.name AS skill_name
       FROM upskill_plans p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN skills s ON s.id = p.skill_id
       WHERE p.id = $1 AND p.team_id = $2`,
      [req.params.id, req.user.team_id]
    );
    if (!plans.length) return res.status(404).json({ error: "Plan not found" });

    const { rows: steps } = await query(
      "SELECT * FROM upskill_steps WHERE plan_id = $1 ORDER BY sort_order, id",
      [req.params.id]
    );
    res.json({ ...plans[0], steps });
  } catch (e) { next(e); }
});

// POST /upskill — create plan (manually or from AI)
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { user_id, skill_id, title, summary, steps } = req.body;
    if (!title) return res.status(400).json({ error: "title required" });

    const targetUserId = user_id || req.user.id;
    const { rows } = await query(
      `INSERT INTO upskill_plans (team_id, user_id, skill_id, title, summary, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.team_id, targetUserId, skill_id || null, title, summary || null, req.user.id]
    );
    const plan = rows[0];

    // Insert steps if provided
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

// PUT /upskill/:id — update plan
router.put("/:id", requireAuth, async (req, res, next) => {
  try {
    const { title, summary, status } = req.body;
    const { rows } = await query(
      `UPDATE upskill_plans SET
         title = COALESCE($3, title),
         summary = COALESCE($4, summary),
         status = COALESCE($5, status),
         updated_at = NOW()
       WHERE id = $1 AND team_id = $2 RETURNING *`,
      [req.params.id, req.user.team_id, title, summary, status]
    );
    if (!rows.length) return res.status(404).json({ error: "Plan not found" });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// DELETE /upskill/:id
router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    await query("DELETE FROM upskill_plans WHERE id = $1 AND team_id = $2", [req.params.id, req.user.team_id]);
    res.status(204).end();
  } catch (e) { next(e); }
});

// PUT /upskill/steps/:id — toggle step completion
router.put("/steps/:id", requireAuth, async (req, res, next) => {
  try {
    const { completed } = req.body;
    const { rows } = await query(
      `UPDATE upskill_steps SET
         completed = $2,
         completed_at = CASE WHEN $2 THEN NOW() ELSE NULL END
       WHERE id = $1 RETURNING *`,
      [req.params.id, !!completed]
    );
    if (!rows.length) return res.status(404).json({ error: "Step not found" });
    // Update plan timestamp
    await query("UPDATE upskill_plans SET updated_at = NOW() WHERE id = $1", [rows[0].plan_id]);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// POST /upskill/generate — AI generates a plan
router.post("/generate", requireAuth, async (req, res, next) => {
  try {
    const { user_name, skill_name, current_level, skill_id, user_id } = req.body;
    if (!user_name || !skill_name) return res.status(400).json({ error: "user_name and skill_name required" });

    const llm = await getLLM();
    const snapshot = await buildSnapshot(req.user.team_id);

    const text = await llm.chat({
      model: llm.fastModel,
      maxTokens: 2000,
      system: `You are a skill development expert. Given team context and a specific upskilling need, generate a structured plan.

Return ONLY valid JSON with this exact structure:
{
  "title": "short plan title",
  "summary": "1-2 sentence overview",
  "steps": [
    { "title": "Step name", "description": "What to do and how" }
  ]
}

Rules:
- Generate 4-8 concrete, actionable steps
- Each step should be achievable in 1-2 weeks
- Include specific resources (courses, docs, exercises) where relevant
- Be practical, not generic
- Return ONLY JSON, no markdown fences`,
      messages: [{
        role: "user",
        content: `Create an upskilling plan for ${user_name} to improve their ${skill_name} proficiency from level ${current_level || "unknown"} to level 4+ (Proficient).

Team context: ${JSON.stringify(snapshot.skills?.map(s => s.name) || [])}`
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

    // Auto-save the plan
    const { rows } = await query(
      `INSERT INTO upskill_plans (team_id, user_id, skill_id, title, summary, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.team_id, user_id || req.user.id, skill_id || null, plan.title, plan.summary, req.user.id]
    );
    const saved = rows[0];

    if (Array.isArray(plan.steps)) {
      for (let i = 0; i < plan.steps.length; i++) {
        await query(
          "INSERT INTO upskill_steps (plan_id, sort_order, title, description) VALUES ($1, $2, $3, $4)",
          [saved.id, i, plan.steps[i].title, plan.steps[i].description || null]
        );
      }
    }

    res.status(201).json({ ...saved, steps: plan.steps });
  } catch (e) {
    console.error("Upskill generate failed:", e);
    next(e);
  }
});

export default router;
