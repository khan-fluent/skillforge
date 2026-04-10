/**
 * Anthropic (Claude) LLM Provider
 *
 * Env vars:
 *   ANTHROPIC_API_KEY  — required
 *   LLM_CHAT_MODEL     — override chat model   (default: claude-opus-4-6)
 *   LLM_FAST_MODEL     — override fast model    (default: claude-sonnet-4-5-20250929)
 */

const DEFAULT_CHAT_MODEL = "claude-opus-4-6";
const DEFAULT_FAST_MODEL = "claude-sonnet-4-5-20250929";

export default async function create() {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is required for the Anthropic provider.");
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const chatModel = process.env.LLM_CHAT_MODEL || DEFAULT_CHAT_MODEL;
  const fastModel = process.env.LLM_FAST_MODEL || DEFAULT_FAST_MODEL;

  return {
    provider: "anthropic",
    chatModel,
    fastModel,

    async chat({ model, system, messages, maxTokens }) {
      const response = await client.messages.create({
        model: model || chatModel,
        max_tokens: maxTokens || 1500,
        system,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      });

      return response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n");
    },
  };
}
