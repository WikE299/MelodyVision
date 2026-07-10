import type { Character } from "../characters";

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
  analysisEngine?: "rich" | "meyda-degraded";
  degraded?: boolean;
  key?: string;
  tempo?: string;
  mood?: string;
  instruments?: string[];
  energy?: string;
  brightness?: string;
  dynamicRange?: string;
  bpm?: number | null;
  duration?: number;
  description?: string;
  spectralCentroid?: number;
  spectralFlatness?: number;
  spectralRolloff?: number;
  segments?: Array<{
    start?: number;
    end?: number;
    energy?: string;
    brightness?: string;
    motion?: string;
    texture?: string;
    dynamic?: string;
    description?: string;
  }>;
  salientMoments?: Array<{
    time?: number;
    type?: string;
    intensity?: number;
    description?: string;
  }>;
  visualMappingHints?: string[];
  sourceMetadata?: {
    title?: string;
    artist?: string;
    tags?: string[];
    source?: string;
  };
  tonalityCandidate?: {
    key?: string | null;
    mode?: string;
    confidence?: number;
  };
  semanticCandidates?: {
    moods?: Array<{ label?: string; score?: number }>;
    textures?: Array<{ label?: string; score?: number }>;
    motions?: Array<{ label?: string; score?: number }>;
    spaces?: Array<{ label?: string; score?: number }>;
  };
  analysisWarnings?: string[];
  curves?: {
    energy?: number[];
    brightness?: number[];
    texture?: number[];
  };
}): string {
  const parts: string[] = [];
  if (analysis.sourceMetadata) {
    const identity = [analysis.sourceMetadata.title, analysis.sourceMetadata.artist]
      .filter(Boolean)
      .join("，");
    const tags = analysis.sourceMetadata.tags?.slice(0, 6).join("、");
    if (identity) parts.push(`已知曲目信息：${identity}`);
    if (tags) parts.push(`来源标签：${tags}`);
  }
  if (analysis.degraded) {
    parts.push("分析状态：新版音乐分析服务暂不可用，以下为 Meyda 降级结果，只能作为粗略听感参考。不可把情绪、段落或乐器判断当作事实。");
  }
  if (analysis.tempo) parts.push(`节奏：${analysis.tempo}`);
  if (analysis.mood) {
    parts.push(analysis.analysisEngine === "rich"
      ? `候选情绪（低权重）：${analysis.mood}`
      : `粗略情绪参考：${analysis.mood}`);
  }
  if (analysis.energy) parts.push(`能量：${analysis.energy}`);
  if (analysis.brightness) parts.push(`音色明暗：${analysis.brightness}`);
  if (analysis.dynamicRange) parts.push(`动态变化：${analysis.dynamicRange}`);
  if (analysis.spectralFlatness != null) {
    const tonal = analysis.spectralFlatness < 0.01 ? "有明显调性" : analysis.spectralFlatness > 0.1 ? "噪声感较强" : "调性与噪声混合";
    parts.push(`音色纯净度：${tonal}（spectral flatness: ${analysis.spectralFlatness}）`);
  }
  if (analysis.spectralRolloff) parts.push(`高频截止：${analysis.spectralRolloff} Hz`);
  if (analysis.key) parts.push(`调性：${analysis.key}`);
  if (analysis.tonalityCandidate?.key) {
    const confidence = analysis.tonalityCandidate.confidence == null
      ? ""
      : `，相对置信度 ${Math.round(analysis.tonalityCandidate.confidence * 100)}%`;
    parts.push(`调性假设（不可当作确定乐理事实）：${analysis.tonalityCandidate.key} ${analysis.tonalityCandidate.mode || ""}${confidence}`);
  }
  if (analysis.instruments?.length) parts.push(`已知来源乐器标签：${analysis.instruments.join("、")}`);
  if (analysis.semanticCandidates) {
    const candidateParts = [
      formatCandidateGroup("质感", analysis.semanticCandidates.textures),
      formatCandidateGroup("动势", analysis.semanticCandidates.motions),
      formatCandidateGroup("空间", analysis.semanticCandidates.spaces),
    ].filter(Boolean);
    if (candidateParts.length) parts.push(`模型候选（低权重、允许忽略）：${candidateParts.join("；")}`);
  }
  if (analysis.segments?.length) {
    parts.push(
      `听感走势：${analysis.segments
        .slice(0, 6)
        .map((segment, index, list) => {
          const phase = getPhaseLabel(index, list.length);
          return `${phase}：能量${segment.energy || "未知"}，音色${segment.brightness || "未知"}，动势${segment.motion || "未知"}，质感${segment.texture || "未知"}，动态${segment.dynamic || "未知"}`;
        })
        .join("；")}`
    );
  }
  if (analysis.salientMoments?.length) {
    parts.push(
      `突出变化：${analysis.salientMoments
        .slice(0, 3)
        .map((moment) => `${moment.type || "变化"}较明显，可理解为音乐内部张力、亮度或质感的转折`)
        .join("；")}`
    );
  }
  if (analysis.curves) {
    const curveParts = [
      analysis.curves.energy?.length ? `能量曲线 ${analysis.curves.energy.join("-")}` : "",
      analysis.curves.brightness?.length ? `明亮度曲线 ${analysis.curves.brightness.join("-")}` : "",
      analysis.curves.texture?.length ? `纹理曲线 ${analysis.curves.texture.join("-")}` : "",
    ].filter(Boolean);
    if (curveParts.length) parts.push(`整体走势参考：${curveParts.join("；")}`);
  }
  if (analysis.visualMappingHints?.length) parts.push(`听感转译参考：${analysis.visualMappingHints.slice(0, 4).map(removeTimeMarkers).join("；")}`);
  if (analysis.duration) parts.push(`时长：约${analysis.duration}秒`);
  if (analysis.description) parts.push(`综合描述：${analysis.description}`);
  parts.push("评论要求：先依据音乐的节奏、动态和结构证据形成自己的听法；候选语义如果与音乐证据冲突就忽略。用音乐家的自然口吻评论听感和画面感，不要提到具体秒数、参数、置信度、曲线、分段或分析术语。评论要能给后续画面生成提供情绪、材质、空间或动势线索。");
  return parts.join("\n");
}

function formatCandidateGroup(
  name: string,
  labels?: Array<{ label?: string; score?: number }>
): string {
  const values = labels
    ?.slice(0, 3)
    .map((item) => item.label)
    .filter((label): label is string => Boolean(label));
  return values?.length ? `${name} ${values.join("、")}` : "";
}

function getPhaseLabel(index: number, total: number): string {
  if (total <= 1) return "整体";
  if (index === 0) return "开头";
  if (index === total - 1) return "收束";
  if (index < total / 2) return "前段";
  if (index > total / 2) return "后段";
  return "中段";
}

function removeTimeMarkers(text: string): string {
  return text
    .replace(/\d+(?:\.\d+)?-\d+(?:\.\d+)?秒/g, "某一段")
    .replace(/\d+(?:\.\d+)?秒附近/g, "某处")
    .replace(/\d+(?:\.\d+)?秒/g, "某处");
}
