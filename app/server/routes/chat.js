import { Router } from "express";
import { getLLM } from "../services/llm/index.js";
import { buildSnapshot } from "../services/snapshot.js";
import { query } from "../db/index.js";
import requireAuth from "../middleware/auth.js";

const router = Router();

const SYSTEM_PROMPT = `You are Skillforge AI, a warm, perceptive team-knowledge analyst.
You help engineering leaders understand their team's skills, identify
bus-factor risks, recommend project staffing, and design learning paths.

You will be given a comprehensive JSON snapshot of ONE team including:
- **People**: names, roles, job titles, skill proficiencies (1=novice → 5=expert),
  business domain expertise, and certifications
- **Skill risk analysis**: bus factor per skill (count of people at level 4+)
- **Domain risk analysis**: bus factor per business domain
- **Upskill plans**: active learning plans with progress tracking
- **Knowledge base**: internal documentation titles and excerpts

Ground every answer in this data — never invent people, skills, or domains.
Reference specific proficiency levels, bus factors, and existing plans when relevant.
If someone already has an upskill plan for a skill, mention their progress.
If there's relevant KB documentation, reference it.
Be concise, direct, and use markdown (headings, tables, bullet lists) for structure.`;

// POST /chat — send message, optionally within a session
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { messages, session_id } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages array required" });
    }

    const llm = await getLLM();
    const snapshot = await buildSnapshot(req.user.team_id);
    const systemWithData = `${SYSTEM_PROMPT}\n\n<team_snapshot>\n${JSON.stringify(snapshot, null, 2)}\n</team_snapshot>`;

    const text = await llm.chat({
      model: llm.chatModel,
      system: systemWithData,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      maxTokens: 1500,
    });

    // Persist to session if provided — validate ownership first
    let sessionId = session_id;
    if (sessionId) {
      const { rows: sessionCheck } = await query(
        "SELECT id FROM chat_sessions WHERE id = $1 AND user_id = $2",
        [sessionId, req.user.id]
      );
      if (sessionCheck.length > 0) {
        const lastUserMsg = messages[messages.length - 1];
        await query("INSERT INTO chat_messages (session_id, role, content) VALUES ($1, 'user', $2)", [sessionId, lastUserMsg.content]);
        await query("INSERT INTO chat_messages (session_id, role, content) VALUES ($1, 'assistant', $2)", [sessionId, text]);
        await query("UPDATE chat_sessions SET updated_at = NOW() WHERE id = $1", [sessionId]);
      } else {
        sessionId = null; // Invalid session, don't persist
      }
    }

    res.json({ role: "assistant", content: text, session_id: sessionId });
  } catch (e) {
    console.error("Chat error:", e);
    next(e);
  }
});

// POST /chat/sessions — create a new session
router.post("/sessions", requireAuth, async (req, res, next) => {
  try {
    const title = req.body.title || "New conversation";
    const { rows } = await query(
      "INSERT INTO chat_sessions (team_id, user_id, title) VALUES ($1, $2, $3) RETURNING *",
      [req.user.team_id, req.user.id, title]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

// GET /chat/sessions — list user's sessions
router.get("/sessions", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT s.*, COUNT(m.id)::int AS message_count
       FROM chat_sessions s
       LEFT JOIN chat_messages m ON m.session_id = s.id
       WHERE s.user_id = $1
       GROUP BY s.id
       ORDER BY s.updated_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// GET /chat/sessions/:id — get session with messages
router.get("/sessions/:id", requireAuth, async (req, res, next) => {
  try {
    const { rows: sessions } = await query(
      "SELECT * FROM chat_sessions WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id]
    );
    if (!sessions.length) return res.status(404).json({ error: "Session not found" });

    const { rows: messages } = await query(
      "SELECT role, content, created_at FROM chat_messages WHERE session_id = $1 ORDER BY created_at",
      [req.params.id]
    );
    res.json({ ...sessions[0], messages });
  } catch (e) { next(e); }
});

// PUT /chat/sessions/:id — rename session
router.put("/sessions/:id", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      "UPDATE chat_sessions SET title = $3 WHERE id = $1 AND user_id = $2 RETURNING *",
      [req.params.id, req.user.id, req.body.title]
    );
    if (!rows.length) return res.status(404).json({ error: "Session not found" });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// DELETE /chat/sessions/:id
router.delete("/sessions/:id", requireAuth, async (req, res, next) => {
  try {
    await query("DELETE FROM chat_sessions WHERE id = $1 AND user_id = $2", [req.params.id, req.user.id]);
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
