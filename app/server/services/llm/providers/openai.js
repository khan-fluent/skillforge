/**
 * OpenAI LLM Provider
 *
 * Env vars:
 *   OPENAI_API_KEY   — required
 *   LLM_CHAT_MODEL   — override chat model   (default: gpt-4o)
 *   LLM_FAST_MODEL   — override fast model    (default: gpt-4o-mini)
 *
 * Install:  npm install openai
 */

const DEFAULT_CHAT_MODEL = "gpt-4o";
const DEFAULT_FAST_MODEL = "gpt-4o-mini";

export default async function create() {
  let OpenAI;
  try {
    ({ default: OpenAI } = await import("openai"));
  } catch {
    throw new Error(
      'OpenAI provider requires the "openai" package. Run: npm install openai'
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for the OpenAI provider.");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const chatModel = process.env.LLM_CHAT_MODEL || DEFAULT_CHAT_MODEL;
  const fastModel = process.env.LLM_FAST_MODEL || DEFAULT_FAST_MODEL;

  return {
    provider: "openai",
    chatModel,
    fastModel,

    async chat({ model, system, messages, maxTokens }) {
      const llmMessages = [];

      if (system) {
        llmMessages.push({ role: "system", content: system });
      }

      for (const m of messages) {
        llmMessages.push({ role: m.role, content: m.content });
      }

      const response = await client.chat.completions.create({
        model: model || chatModel,
        max_tokens: maxTokens || 1500,
        messages: llmMessages,
      });

      return response.choices[0]?.message?.content || "";
    },
  };
}
