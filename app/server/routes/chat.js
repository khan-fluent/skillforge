import { Router } from "express";
import { getLLM } from "../services/llm/index.js";
import { buildSnapshot } from "../services/snapshot.js";
import requireAuth from "../middleware/auth.js";

const router = Router();

const SYSTEM_PROMPT = `You are Skillforge AI, a warm, perceptive team-knowledge analyst.
You help engineering leaders understand their team's skills, identify
bus-factor risks, recommend project staffing, and design learning paths.

You will be given a JSON snapshot of ONE team's people, skills, proficiency
levels (1=novice → 5=expert), certifications, and bus-factor analysis.
Ground every answer in this data — never invent people or skills. If asked
for staffing, return a ranked shortlist with the specific skills that
qualify each person. If asked for learning paths, suggest concrete next
skills based on adjacency to what the person already knows. Be concise,
direct, and use markdown (headings, tables, bullet lists) for structure.`;

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { messages } = req.body;
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

    res.json({ role: "assistant", content: text });
  } catch (e) {
    console.error("Chat error:", e);
    next(e);
  }
});

export default router;
