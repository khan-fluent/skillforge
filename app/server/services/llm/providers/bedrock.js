/**
 * AWS Bedrock LLM Provider
 *
 * Uses the Converse API — works with Claude, Llama, Mistral, and any model
 * available in your Bedrock region.
 *
 * Env vars:
 *   AWS_REGION / AWS_DEFAULT_REGION — required (Bedrock region)
 *   LLM_CHAT_MODEL  — override chat model   (default: anthropic.claude-sonnet-4-20250514-v1:0)
 *   LLM_FAST_MODEL  — override fast model    (default: anthropic.claude-haiku-4-20250414-v1:0)
 *
 * Auth: Uses the default AWS credential chain (env vars, instance profile,
 *       SSO, ~/.aws/credentials). No API key needed.
 *
 * Install:  npm install @aws-sdk/client-bedrock-runtime
 */

const DEFAULT_CHAT_MODEL = "anthropic.claude-sonnet-4-20250514-v1:0";
const DEFAULT_FAST_MODEL = "anthropic.claude-haiku-4-20250414-v1:0";

export default async function create() {
  let BedrockRuntimeClient, ConverseCommand;
  try {
    ({ BedrockRuntimeClient, ConverseCommand } = await import(
      "@aws-sdk/client-bedrock-runtime"
    ));
  } catch {
    throw new Error(
      'Bedrock provider requires "@aws-sdk/client-bedrock-runtime". Run: npm install @aws-sdk/client-bedrock-runtime'
    );
  }

  const region =
    process.env.AWS_REGION ||
    process.env.AWS_DEFAULT_REGION ||
    "us-east-1";

  const client = new BedrockRuntimeClient({ region });

  const chatModel = process.env.LLM_CHAT_MODEL || DEFAULT_CHAT_MODEL;
  const fastModel = process.env.LLM_FAST_MODEL || DEFAULT_FAST_MODEL;

  return {
    provider: "bedrock",
    chatModel,
    fastModel,

    async chat({ model, system, messages, maxTokens }) {
      const params = {
        modelId: model || chatModel,
        inferenceConfig: { maxTokens: maxTokens || 1500 },
        messages: messages.map((m) => ({
          role: m.role,
          content: [{ text: m.content }],
        })),
      };

      if (system) {
        params.system = [{ text: system }];
      }

      const command = new ConverseCommand(params);
      const response = await client.send(command);

      return (
        response.output?.message?.content
          ?.map((b) => b.text)
          .filter(Boolean)
          .join("\n") || ""
      );
    },
  };
}
