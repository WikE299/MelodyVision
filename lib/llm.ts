/**
 * LLM wrapper for Claude API calls.
 * TODO: Replace mock with actual Claude API integration.
 */

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Call the LLM with a system prompt and user message.
 * For now, returns mock responses.
 */
export async function callLLM(params: {
  systemPrompt: string;
  userMessage: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<LLMResponse> {
  const { systemPrompt, temperature = 0.7, maxTokens = 200 } = params;

  // TODO: Replace with actual Claude API call
  // Example:
  // const response = await fetch('https://api.anthropic.com/v1/messages', {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json',
  //     'x-api-key': process.env.ANTHROPIC_API_KEY!,
  //     'anthropic-version': '2023-06-01',
  //   },
  //   body: JSON.stringify({
  //     model: 'claude-sonnet-4-20250514',
  //     max_tokens: maxTokens,
  //     temperature,
  //     system: systemPrompt,
  //     messages: [{ role: 'user', content: userMessage }],
  //   }),
  // });
  // const data = await response.json();
  // return { content: data.content[0].text, model: data.model, usage: data.usage };

  // Mock response based on system prompt content
  await new Promise((resolve) => setTimeout(resolve, 300));

  let mockResponse = "此曲甚妙。";

  if (systemPrompt.includes("伯牙")) {
    mockResponse = "此曲有山之巍峨，水之绵长，然弹者心不在焉。";
  } else if (systemPrompt.includes("师旷")) {
    mockResponse = "此音合于黄钟，天下将有善政。";
  } else if (systemPrompt.includes("蔡文姬")) {
    mockResponse = "这曲子……像我当年在草原上听到的风声，带着故乡的味道。";
  } else if (systemPrompt.includes("嵇康")) {
    mockResponse = "你说它悲伤？悲伤在你心中，不在弦上。";
  } else if (systemPrompt.includes("白居易")) {
    mockResponse = "此曲好在不装，老妪能解，便是好曲。";
  } else if (systemPrompt.includes("姜夔")) {
    mockResponse = "格律精严，有清气，可品。";
  } else if (systemPrompt.includes("朱载堉")) {
    mockResponse = "五声音阶排列得当，无明显偏差。";
  } else if (systemPrompt.includes("阿炳")) {
    mockResponse = "我懂，我和你一样苦。";
  } else if (systemPrompt.includes("黄霑")) {
    mockResponse = "好旋律！一听就忘不了，好听就是硬道理。";
  } else if (systemPrompt.includes("谭盾")) {
    mockResponse = "这才是未来，音乐不该有固定的形态。";
  }

  return {
    content: mockResponse,
    model: "claude-sonnet-4-20250514-mock",
    usage: { inputTokens: 150, outputTokens: 50 },
  };
}

/**
 * Call the LLM for image prompt generation.
 * TODO: Replace mock with actual API call.
 */
export async function callLLMForImagePrompt(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 500));

  return `A serene Chinese ink wash painting style landscape. Misty mountains rise in the background, with a tranquil river flowing through a bamboo forest. Soft morning light filters through the mist, creating a dreamlike atmosphere. Delicate cherry blossoms scatter in the gentle breeze. The palette is muted with soft greens, grays, and pale pinks. Traditional Chinese brush strokes define the mountains and water. The composition follows the rule of thirds, with a small wooden bridge in the foreground adding depth and human presence to the natural scene.`;
}
