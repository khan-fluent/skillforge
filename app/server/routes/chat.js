import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { buildSnapshot } from "../services/snapshot.js";

const router = Router();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-opus-4-6";

const SYSTEM_PROMPT = `You are Skillforge AI, an expert team-knowledge analyst.
You help engineering leaders understand their team's skills, identify
bus-factor risks, recommend project staffing, and design learning paths.

You will be given a JSON snapshot of the team's people, skills, proficiency
levels (1=novice → 5=expert), certifications, and bus-factor analysis.
Ground every answer in this data — never invent people or skills. If asked
for staffing, return a ranked shortlist with the specific skills that
qualify each person. If asked for learning paths, suggest concrete next
skills based on adjacency to what the person already knows. Be concise,
direct, and use markdown (headings, tables, bullet lists) for structure.`;

router.post("/", async (req, res, next) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages array required" });
    }

    const snapshot = await buildSnapshot();
    const systemWithData = `${SYSTEM_PROMPT}\n\n<team_snapshot>\n${JSON.stringify(snapshot, null, 2)}\n</team_snapshot>`;

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: systemWithData,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    res.json({ role: "assistant", content: text });
  } catch (e) {
    console.error("Chat error:", e);
    next(e);
  }
});

export default router;
