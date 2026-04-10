/**
 * Azure OpenAI LLM Provider
 *
 * Env vars:
 *   AZURE_OPENAI_ENDPOINT    — required (e.g. https://my-resource.openai.azure.com)
 *   AZURE_OPENAI_API_KEY     — required
 *   AZURE_OPENAI_API_VERSION — optional (default: 2024-12-01-preview)
 *   LLM_CHAT_MODEL           — Azure deployment name for chat   (default: gpt-4o)
 *   LLM_FAST_MODEL           — Azure deployment name for fast   (default: gpt-4o-mini)
 *
 * Install:  npm install openai
 */

const DEFAULT_CHAT_MODEL = "gpt-4o";
const DEFAULT_FAST_MODEL = "gpt-4o-mini";

export default async function create() {
  let AzureOpenAI;
  try {
    ({ AzureOpenAI } = await import("openai"));
  } catch {
    throw new Error(
      'Azure OpenAI provider requires the "openai" package. Run: npm install openai'
    );
  }

  if (!process.env.AZURE_OPENAI_ENDPOINT) {
    throw new Error(
      "AZURE_OPENAI_ENDPOINT is required for the Azure OpenAI provider."
    );
  }
  if (!process.env.AZURE_OPENAI_API_KEY) {
    throw new Error(
      "AZURE_OPENAI_API_KEY is required for the Azure OpenAI provider."
    );
  }

  const client = new AzureOpenAI({
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview",
  });

  const chatModel = process.env.LLM_CHAT_MODEL || DEFAULT_CHAT_MODEL;
  const fastModel = process.env.LLM_FAST_MODEL || DEFAULT_FAST_MODEL;

  return {
    provider: "azure",
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
