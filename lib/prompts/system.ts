import { Character } from "../characters";

/**
 * Build the full system prompt for a character commenting on music.
 * Includes: character identity + music analysis context + user input (if any).
 */
export function buildCommentPrompt(
  character: Character,
  musicContext: string,
  userNote?: string
): string {
  let prompt = `${character.systemPrompt}

---

你正在听一首音乐。以下是音乐分析信息：

${musicContext}`;

  if (userNote) {
    prompt += `

听者还说了：「${userNote}」
可以参考，但评论焦点仍然在音乐本身。`;
  }

  return prompt;
}

/**
 * Music context description template.
 * This is the "analysis info" injected into the system prompt.
 */
export function formatMusicContext(analysis: {
  key?: string;
  tempo?: string;
  mood?: string;
  instruments?: string[];
  energy?: string;
  brightness?: string;
  dynamicRange?: string;
  bpm?: number;
  duration?: number;
  description?: string;
}): string {
  const parts: string[] = [];
  if (analysis.tempo) parts.push(`节奏：${analysis.tempo}`);
  if (analysis.mood) parts.push(`情绪特征：${analysis.mood}`);
  if (analysis.energy) parts.push(`能量：${analysis.energy}`);
  if (analysis.brightness) parts.push(`音色明暗：${analysis.brightness}`);
  if (analysis.dynamicRange) parts.push(`动态变化：${analysis.dynamicRange}`);
  if (analysis.key) parts.push(`调性：${analysis.key}`);
  if (analysis.instruments?.length) parts.push(`乐器：${analysis.instruments.join("、")}`);
  if (analysis.duration) parts.push(`时长：约${analysis.duration}秒`);
  if (analysis.description) parts.push(`综合描述：${analysis.description}`);
  return parts.join("\n");
}
