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
const IMAGE_PROMPT_MODEL = process.env.LLM_IMAGE_PROMPT_MODEL || MODEL;

export interface ImagePromptRewriteAttempt {
  content: string;
  finishReason: string | null;
  model: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    reasoningTokens?: number;
  };
}

export interface PromptDirectorResult {
  content: string;
  finishReason: string | null;
  model: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    reasoningTokens?: number;
  };
}

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

export async function callPromptDirector(systemPrompt: string): Promise<PromptDirectorResult> {
  const response = await client.chat.completions.create({
    model: IMAGE_PROMPT_MODEL,
    max_tokens: 5000,
    temperature: 0.35,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content:
          "Create the structured image prompt brief now. Return valid JSON only, no markdown.",
      },
    ],
  });

  const choice = response.choices[0];

  return {
    content: choice?.message.content || "",
    finishReason: choice?.finish_reason || null,
    model: response.model,
    usage: response.usage
      ? {
          inputTokens: response.usage.prompt_tokens,
          outputTokens: response.usage.completion_tokens,
          reasoningTokens: response.usage.completion_tokens_details?.reasoning_tokens,
        }
      : undefined,
  };
}

export async function callPromptDirectorRepair(
  systemPrompt: string
): Promise<PromptDirectorResult> {
  const response = await client.chat.completions.create({
    model: IMAGE_PROMPT_MODEL,
    max_tokens: 5000,
    temperature: 0.35,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content:
          "Repair the structured image prompt brief according to the validation errors. Return valid JSON only, no markdown.",
      },
    ],
  });

  const choice = response.choices[0];

  return {
    content: choice?.message.content || "",
    finishReason: choice?.finish_reason || null,
    model: response.model,
    usage: response.usage
      ? {
          inputTokens: response.usage.prompt_tokens,
          outputTokens: response.usage.completion_tokens,
          reasoningTokens: response.usage.completion_tokens_details?.reasoning_tokens,
        }
      : undefined,
  };
}

export async function callLLMForImagePrompt(
  systemPrompt: string,
  userMessage: string
): Promise<{ content: string; attempts: ImagePromptRewriteAttempt[] }> {
  const attempts: ImagePromptRewriteAttempt[] = [];
  const requests = [
    {
      maxTokens: 3200,
      userMessage,
    },
    {
      maxTokens: 4500,
      userMessage:
        "Return the final English image-generation prompt only. Keep it under 120 words. Do not explain, do not think step by step, do not use markdown.",
    },
  ];

  for (const request of requests) {
    const response = await client.chat.completions.create({
      model: IMAGE_PROMPT_MODEL,
      max_tokens: request.maxTokens,
      temperature: 0.45,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: request.userMessage },
      ],
    });

    const choice = response.choices[0];
    const content = choice?.message.content || "";
    const usage = response.usage
      ? {
          inputTokens: response.usage.prompt_tokens,
          outputTokens: response.usage.completion_tokens,
          reasoningTokens: response.usage.completion_tokens_details?.reasoning_tokens,
        }
      : undefined;

    attempts.push({
      content,
      finishReason: choice?.finish_reason || null,
      model: response.model,
      usage,
    });

    if (content.trim() && choice?.finish_reason !== "length") {
      return { content, attempts };
    }
  }

  return { content: attempts.find((attempt) => attempt.content.trim())?.content || "", attempts };
}
