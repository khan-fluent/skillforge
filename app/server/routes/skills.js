import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { query } from "../db/index.js";
import requireAuth, { requireAdmin } from "../middleware/auth.js";

const router = Router();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT s.*,
              COUNT(pr.id)::int                          AS people_count,
              COALESCE(AVG(pr.level), 0)::float          AS avg_level,
              COUNT(*) FILTER (WHERE pr.level >= 4)::int AS proficient_count
       FROM skills s
       LEFT JOIN proficiencies pr ON pr.skill_id = s.id
       WHERE s.team_id = $1
       GROUP BY s.id
       ORDER BY s.domain, s.name`,
      [req.user.team_id]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { name, domain, description, deprecated } = req.body;
    if (!name || !domain) return res.status(400).json({ error: "name and domain required" });
    const { rows } = await query(
      `INSERT INTO skills (team_id, name, domain, description, deprecated)
       VALUES ($1, $2, $3, $4, COALESCE($5, false))
       ON CONFLICT (team_id, name) DO UPDATE SET
         domain = EXCLUDED.domain,
         description = COALESCE(EXCLUDED.description, skills.description)
       RETURNING *`,
      [req.user.team_id, name, domain, description || null, deprecated]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

// Bulk import — used by the AI generation flow. Accepts an array of skills.
router.post("/bulk", requireAuth, async (req, res, next) => {
  try {
    const { skills } = req.body;
    if (!Array.isArray(skills) || skills.length === 0) {
      return res.status(400).json({ error: "skills array required" });
    }
    const results = [];
    for (const s of skills) {
      if (!s.name || !s.domain) continue;
      const { rows } = await query(
        `INSERT INTO skills (team_id, name, domain, description, deprecated)
         VALUES ($1, $2, $3, $4, false)
         ON CONFLICT (team_id, name) DO NOTHING
         RETURNING *`,
        [req.user.team_id, s.name, s.domain, s.description || null]
      );
      if (rows.length) results.push(rows[0]);
    }
    res.status(201).json({ added: results.length, skills: results });
  } catch (e) { next(e); }
});

// AI-powered skill generation. Takes a free-text description of the team's
// stack and returns structured skill suggestions with domains.
router.post("/generate", requireAuth, async (req, res, next) => {
  try {
    const { description } = req.body;
    if (!description || description.trim().length < 10) {
      return res.status(400).json({ error: "Describe your stack in at least a sentence." });
    }

    // Fetch existing skills so Claude can avoid duplicates.
    const { rows: existing } = await query(
      "SELECT name FROM skills WHERE team_id = $1",
      [req.user.team_id]
    );
    const existingNames = existing.map((s) => s.name);

    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2000,
      system: `You are a skill-taxonomy expert for engineering teams. Given a
free-text description of a team's tech stack, tools, and practices, generate
a JSON array of skill objects. Each object must have:

  name        — concise skill name (e.g. "PostgreSQL", "Kubernetes", "Go")
  domain      — one of: databases, cloud, languages, tools, practices, security, data, other
  description — one sentence explaining what this skill covers

Rules:
- Be thorough — extract every distinct technology, framework, cloud service,
  practice, and tool mentioned or strongly implied.
- Don't duplicate skills the team already tracks: ${JSON.stringify(existingNames)}
- Don't invent skills the description doesn't support.
- Group correctly: "React" → languages, "AWS" → cloud, "Terraform" → tools,
  "PostgreSQL" → databases, "CI/CD" → practices, "Datadog" → tools.
- Return ONLY valid JSON — no markdown fences, no commentary.`,
      messages: [{ role: "user", content: description.trim() }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    let skills;
    try {
      skills = JSON.parse(text);
    } catch {
      // Try to extract JSON from the response if Claude wrapped it.
      const match = text.match(/\[[\s\S]*\]/);
      if (match) skills = JSON.parse(match[0]);
      else return res.status(502).json({ error: "AI returned invalid JSON. Try again." });
    }

    if (!Array.isArray(skills)) {
      return res.status(502).json({ error: "AI returned unexpected format. Try again." });
    }

    res.json({ skills });
  } catch (e) {
    console.error("Skill generation failed:", e);
    next(e);
  }
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await query("DELETE FROM skills WHERE id = $1 AND team_id = $2", [req.params.id, req.user.team_id]);
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
