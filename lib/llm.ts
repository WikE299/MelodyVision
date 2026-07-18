import OpenAI from "openai";

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface LLMStreamDelta {
  content: string;
  model: string;
}

export interface LLMStreamRequest {
  systemPrompt: string;
  userMessage: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
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
  signal?: AbortSignal;
}): Promise<LLMResponse> {
  const { systemPrompt, userMessage, temperature = 0.7, maxTokens = 2000, signal } = params;
  const request = {
    model: MODEL,
    max_tokens: maxTokens,
    temperature,
    thinking: { type: "disabled" as const },
    messages: [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: userMessage },
    ],
  };

  const response = await client.chat.completions.create(
    request,
    signal ? { signal } : undefined
  );

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

export async function* streamLLM(params: LLMStreamRequest): AsyncGenerator<LLMStreamDelta> {
  const {
    systemPrompt,
    userMessage,
    temperature = 0.7,
    maxTokens = 2000,
    signal,
  } = params;
  const request = {
    model: MODEL,
    max_tokens: maxTokens,
    temperature,
    stream: true as const,
    thinking: { type: "disabled" as const },
    messages: [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: userMessage },
    ],
  };
  const stream = await client.chat.completions.create(
    request,
    signal ? { signal } : undefined
  );

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || "";
    if (content) {
      yield {
        content,
        model: chunk.model || MODEL,
      };
    }
  }
}

export async function callPromptDirector(systemPrompt: string): Promise<PromptDirectorResult> {
  const request = {
    model: IMAGE_PROMPT_MODEL,
    max_tokens: 5000,
    temperature: 0.55,
    thinking: { type: "disabled" as const },
    response_format: { type: "json_object" as const },
    messages: [
      { role: "system" as const, content: systemPrompt },
      {
        role: "user" as const,
        content:
          "Create the structured image prompt brief now. Return valid JSON only, no markdown.",
      },
    ],
  };
  const response = await client.chat.completions.create(request);

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
  const request = {
    model: IMAGE_PROMPT_MODEL,
    max_tokens: 5000,
    temperature: 0.35,
    thinking: { type: "disabled" as const },
    response_format: { type: "json_object" as const },
    messages: [
      { role: "system" as const, content: systemPrompt },
      {
        role: "user" as const,
        content:
          "Repair the structured image prompt brief according to the validation errors. Return valid JSON only, no markdown.",
      },
    ],
  };
  const response = await client.chat.completions.create(request);

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

export async function callImagePromptSafetyRewrite(
  prompt: string
): Promise<PromptDirectorResult> {
  const request = {
    model: IMAGE_PROMPT_MODEL,
    max_tokens: 1200,
    temperature: 0.2,
    thinking: { type: "disabled" as const },
    messages: [
      {
        role: "system" as const,
        content: `You are a safety editor for an image-generation prompt.

Rewrite the supplied prompt into an entirely original, non-referential visual description.
- Remove every name or title from existing films, television, games, comics, characters, franchises, brands, studios, and artists.
- Translate removed references into generic drawable traits: object, motion, material, palette, lighting, atmosphere, and composition.
- Preserve the emotional meaning and concrete visual decisions.
- Do not depict people, human figures, faces, bodies, portraits, silhouettes, crowds, or characters.
- Do not include visible text, letters, captions, signs, logos, signatures, or watermarks.
- Do not mention copyright, infringement, IP, source material, rewriting, safety, or prompt.
- Return only one English image-generation prompt of 80-150 words, with no markdown or explanation.`,
      },
      {
        role: "user" as const,
        content: prompt,
      },
    ],
  };
  const response = await client.chat.completions.create(request);
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
    const completionRequest = {
      model: IMAGE_PROMPT_MODEL,
      max_tokens: request.maxTokens,
      temperature: 0.45,
      thinking: { type: "disabled" as const },
      messages: [
        { role: "system" as const, content: systemPrompt },
        { role: "user" as const, content: request.userMessage },
      ],
    };
    const response = await client.chat.completions.create(completionRequest);

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
