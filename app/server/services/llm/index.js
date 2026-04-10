/**
 * LLM Adapter Factory
 *
 * Reads LLM_PROVIDER env var and returns a provider instance that implements:
 *   chat({ model, system, messages, maxTokens }) → string
 *
 * Supported providers: anthropic (default), openai, bedrock, azure
 *
 * Each provider also exposes:
 *   .provider    — provider name string
 *   .chatModel   — default model for conversational use
 *   .fastModel   — default model for quick/structured generation
 */

const PROVIDERS = {
  anthropic: () => import("./providers/anthropic.js"),
  openai: () => import("./providers/openai.js"),
  bedrock: () => import("./providers/bedrock.js"),
  azure: () => import("./providers/azure.js"),
};

let instance = null;

async function createProvider() {
  const name = (process.env.LLM_PROVIDER || "anthropic").toLowerCase();

  const loader = PROVIDERS[name];
  if (!loader) {
    const supported = Object.keys(PROVIDERS).join(", ");
    throw new Error(
      `Unknown LLM_PROVIDER "${name}". Supported: ${supported}`
    );
  }

  const mod = await loader();
  return mod.default();
}

export async function getLLM() {
  if (!instance) {
    instance = await createProvider();
  }
  return instance;
}

export default getLLM;
