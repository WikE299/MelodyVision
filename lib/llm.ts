import OpenAI from "openai";

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

const client = new OpenAI({
  apiKey: process.env.LLM_API_KEY,
  baseURL: process.env.LLM_BASE_URL,
});

const MODEL = process.env.LLM_MODEL || "mimo-v2.5-pro";

export async function callLLM(params: {
  systemPrompt: string;
  userMessage: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<LLMResponse> {
  const { systemPrompt, userMessage, temperature = 0.7, maxTokens = 2000 } = params;

  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: maxTokens,
    temperature,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  });

  const choice = response.choices[0];

  return {
    content: choice.message.content || "……",
    model: response.model,
    usage: response.usage
      ? {
          inputTokens: response.usage.prompt_tokens,
          outputTokens: response.usage.completion_tokens,
        }
      : undefined,
  };
}

export async function callLLMForImagePrompt(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 500,
    temperature: 0.7,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  });

  return response.choices[0].message.content || "";
}
