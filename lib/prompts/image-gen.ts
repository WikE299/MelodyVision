import { Character } from "../characters";

/**
 * Synthesize multiple character comments into a single image generation prompt.
 * The prompt is hidden from the user.
 */
export function synthesizeImagePrompt(
  characters: Character[],
  comments: { characterId: string; text: string }[],
  presets: {
    style?: string;
    mood?: string;
    tone?: string;
  },
  userNote?: string
): string {
  const commentSummary = comments
    .map((c) => {
      const char = characters.find((ch) => ch.id === c.characterId);
      return char ? `${char.name}说：${c.text}` : c.text;
    })
    .join("\n");

  let prompt = `你是一位跨模态艺术创作助手。根据以下音乐评论和预设，生成一段适合 AI 绘画工具的英文 prompt。

音乐家评论：
${commentSummary}`;

  if (userNote) {
    prompt += `\n\n用户感想：${userNote}`;
  }

  prompt += `\n\n视觉预设：
风格：${presets.style || "水墨"}
情绪：${presets.mood || "宁静"}
色调：${presets.tone || "淡雅"}`;

  prompt += `

要求：
1. 将音乐家的评论转化为视觉意象
2. 融合所有音乐家的视角，不要遗漏任何人
3. 输出英文 prompt，100-150 词
4. 描述具体的画面：构图、色彩、光影、氛围
5. 不要提及"音乐"或"评论"，只描述最终画面
6. 融入风格、情绪、色调预设`;

  return prompt;
}

/**
 * Build the final user-facing message for image generation.
 */
export function buildImageGenUserMessage(presets: {
  style: string;
  mood: string;
  tone: string;
}): string {
  return `请根据以上分析，生成画面描述。预设：${presets.style}风格，${presets.mood}情绪，${presets.tone}色调。`;
}
