import { Character } from "../characters";
import {
  buildVisualPresetPrompt,
  type VisualPresetPrompt,
} from "./visual-presets";

export interface PromptDirectorInput {
  comments: Array<{
    characterId: string;
    speaker: string;
    comment: string;
  }>;
  userNote: string;
  musicAnalysis: {
    description?: unknown;
    tempo?: unknown;
    mood?: unknown;
    energy?: unknown;
    brightness?: unknown;
    dynamicRange?: unknown;
    bpm?: unknown;
    duration?: unknown;
    spectralCentroid?: unknown;
    spectralFlatness?: unknown;
    spectralRolloff?: unknown;
    segments?: unknown;
    salientMoments?: unknown;
    curves?: unknown;
    visualMappingHints?: unknown;
  };
  visualPreset: VisualPresetPrompt;
}

export interface PromptDirectorBrief {
  coreEmotion: string;
  visualDomain: string;
  userNoteTrace: string;
  sourceMappings: Array<{
    characterId: string;
    speaker: string;
    visualTranslation: string;
  }>;
  visualSubject: string;
  scene: string;
  composition: string;
  noveltyStrategy: string;
  style: string;
  colorPalette: string;
  lighting: string;
  atmosphere: string;
  visualKeywords: string[];
  symbolicElements: string[];
  mustInclude: string[];
  mustAvoid: string[];
  finalPrompt: string;
  negativePrompt: string;
}

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
  userNote?: string,
  musicAnalysis?: Record<string, unknown>
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

  if (musicAnalysis) {
    const musicContext = [
      musicAnalysis.description,
      musicAnalysis.tempo,
      musicAnalysis.mood,
      musicAnalysis.energy,
      musicAnalysis.brightness,
      formatCompactMusicEvidence(musicAnalysis),
    ]
      .filter(Boolean)
      .map(String)
      .join("；");

    if (musicContext) {
      prompt += `\n\n音频分析：${musicContext}`;
    }
  }

  const visualPreset = buildVisualPresetPrompt(presets);
  prompt += `\n\n视觉预设：
风格：${visualPreset.style} — ${visualPreset.stylePrompt}
情绪：${visualPreset.mood} — ${visualPreset.moodPrompt}
色调：${visualPreset.tone} — ${visualPreset.tonePrompt}`;

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

export function buildPromptDirectorInput(
  characters: Character[],
  comments: { characterId: string; text: string }[],
  presets: {
    style?: string;
    mood?: string;
    tone?: string;
  },
  userNote?: string,
  musicAnalysis?: Record<string, unknown>
): PromptDirectorInput {
  const commentSummary = comments.map((comment) => {
    const character = characters.find((ch) => ch.id === comment.characterId);
    return {
      characterId: comment.characterId,
      speaker: character?.name || comment.characterId,
      comment: comment.text,
    };
  });
  const musicContext = musicAnalysis
    ? {
        description: musicAnalysis.description,
        tempo: musicAnalysis.tempo,
        mood: musicAnalysis.mood,
        energy: musicAnalysis.energy,
        brightness: musicAnalysis.brightness,
        dynamicRange: musicAnalysis.dynamicRange,
        bpm: musicAnalysis.bpm,
        duration: musicAnalysis.duration,
        spectralCentroid: musicAnalysis.spectralCentroid,
        spectralFlatness: musicAnalysis.spectralFlatness,
        spectralRolloff: musicAnalysis.spectralRolloff,
        segments: sanitizeSegments(musicAnalysis.segments),
        salientMoments: sanitizeMoments(musicAnalysis.salientMoments, musicAnalysis.duration),
        curves: musicAnalysis.curves,
        visualMappingHints: sanitizeHints(musicAnalysis.visualMappingHints),
      }
    : {};

  return {
    comments: commentSummary,
    userNote: userNote || "",
    musicAnalysis: musicContext,
    visualPreset: buildVisualPresetPrompt(presets),
  };
}

export function buildPromptDirectorInstruction(input: PromptDirectorInput): string {
  return `You are Prompt Director for a music-to-image product.

Your job is to act as a visual creative director and reliability agent. First build a concise visual plan that faithfully translates the source material, then write the image-generation prompt. The selected visual preset provides production constraints, not a reusable scene template.

Hard rules:
1. User note has the highest priority for personal meaning.
2. Every musician comment must influence the visual plan. Do not drop any speaker, and preserve each characterId exactly in sourceMappings.
3. Convert phrases into drawable visual terms: subject, setting, objects, motion, texture, palette, lighting, atmosphere, composition. Do not simply quote or summarize the comments.
4. Audio analysis controls motion, density, contrast, brightness, material texture, rhythm contour, and visual tension. Use segments, salientMoments, curves, and visualMappingHints when available, but translate them into visual qualities instead of timecoded narration.
5. Treat visualPreset.stylePrompt, moodPrompt, and tonePrompt as hard production constraints. Integrate them into finalPrompt naturally. "自动" means you must make a deliberate choice from this specific source material, not reuse a default.
6. If inputs conflict, preserve the conflict visually, for example calm surface with hidden pressure.
7. Do not mention music, comments, BPM, musicians, analysis, or prompt in finalPrompt.
8. finalPrompt must be concrete and imageable, not abstract.
9. Avoid copyrighted game character names or exact franchise names in finalPrompt; translate them into visual traits instead.
10. Do not include any people, human figures, faces, bodies, portraits, silhouettes, crowds, or characters in the image.
11. Do not include any visible text, letters, captions, handwriting, signs, subtitles, logos, or watermarks in the image.
12. Choose a visualDomain before writing finalPrompt. Consider objects, interiors, architecture, natural phenomena, still life, material studies, geometric space, microscopic worlds, surreal environments, machines, weather systems, or ceremonial spaces as appropriate.
13. Do not default to mountains, rivers, mist, bamboo, moonlight, bridges, or generic tranquil landscapes unless those motifs are directly justified by the inputs.
14. The medium describes how the image is made; it must not dictate what the image depicts. An ink painting does not automatically require a landscape.
15. Commit to one clear focal subject and one distinctive compositional idea. Avoid generic collections of poetic motifs.
16. finalPrompt must be a true composite of music traits, musician comments, and user note. If userNote is empty, userNoteTrace must say "none".
17. If detailed audio evidence exists, at least one concrete visual decision must come from the strongest phase or a salient change.
18. Return valid JSON only.

Input:
${JSON.stringify(input, null, 2)}

Return this exact JSON shape:
{
  "coreEmotion": "short English phrase",
  "visualDomain": "one concrete domain, such as interior, architecture, object still life, weather system, microscopic world, surreal space",
  "userNoteTrace": "how the user note becomes a visual detail, or none",
  "sourceMappings": [
    {
      "characterId": "exact characterId from input",
      "speaker": "speaker name from input",
      "visualTranslation": "specific drawable contribution from this comment"
    }
  ],
  "visualSubject": "short English phrase",
  "scene": "short English phrase",
  "composition": "short English phrase",
  "noveltyStrategy": "how this avoids a default landscape or repeated style",
  "style": "short English phrase",
  "colorPalette": "short English phrase",
  "lighting": "short English phrase",
  "atmosphere": "short English phrase",
  "visualKeywords": ["keyword", "keyword"],
  "symbolicElements": ["element", "element"],
  "mustInclude": ["specific visual requirement; include the speaker name and their visual contribution"],
  "mustAvoid": ["negative visual requirement"],
  "finalPrompt": "English image-generation prompt, 90-140 words, concrete visual description only",
  "negativePrompt": "comma-separated English negative prompt; must include people, human figure, face, portrait, character, text, letters, caption, logo, watermark"
}`;
}

export function buildPromptDirectorRepairInstruction(params: {
  originalInput: PromptDirectorInput;
  previousRawOutput: string;
  parsedBrief: PromptDirectorBrief | null;
  validationErrors: string[];
  validationWarnings: string[];
  attempt: number;
}): string {
  return `${buildPromptDirectorInstruction(params.originalInput)}

Your previous output failed validation during agent-loop attempt ${params.attempt}.

Validation errors:
${params.validationErrors.map((error) => `- ${error}`).join("\n") || "- none"}

Validation warnings:
${params.validationWarnings.map((warning) => `- ${warning}`).join("\n") || "- none"}

Previous raw output:
${params.previousRawOutput || "(empty)"}

Parsed previous JSON:
${JSON.stringify(params.parsedBrief, null, 2)}

Repair the output. Return the same JSON shape only.
Do not explain.
Keep every input characterId exactly once in sourceMappings.
Make userNoteTrace concrete when userNote is present.
Do not remove any musician's influence.
Do not include forbidden meta words in finalPrompt.
Do not include any people or visible text in finalPrompt.`;
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

export function formatCompactMusicEvidence(musicAnalysis: Record<string, unknown>): string {
  const segments = Array.isArray(musicAnalysis.segments)
    ? musicAnalysis.segments.slice(0, 4).map((segment, index, list) => {
        if (!segment || typeof segment !== "object") return "";
        const item = segment as Record<string, unknown>;
        return `${getPhaseLabel(index, list.length)} ${item.energy || ""} ${item.brightness || ""} ${item.motion || ""} ${item.texture || ""}`.trim();
      })
    : [];
  const moments = Array.isArray(musicAnalysis.salientMoments)
    ? musicAnalysis.salientMoments.slice(0, 2).map((moment) => {
        if (!moment || typeof moment !== "object") return "";
        const item = moment as Record<string, unknown>;
        return `${item.type || "change"} shapes a visual shift`;
      })
    : [];
  const hints = Array.isArray(musicAnalysis.visualMappingHints)
    ? sanitizeHints(musicAnalysis.visualMappingHints).slice(0, 3)
    : [];
  return [...segments, ...moments, ...hints].filter(Boolean).join("；");
}

function sanitizeSegments(value: unknown) {
  if (!Array.isArray(value)) return value;
  return value.slice(0, 6).map((segment, index, list) => {
    if (!segment || typeof segment !== "object") return segment;
    const item = segment as Record<string, unknown>;
    return {
      phase: getPhaseLabel(index, list.length),
      energy: item.energy,
      brightness: item.brightness,
      motion: item.motion,
      texture: item.texture,
      dynamic: item.dynamic,
    };
  });
}

function sanitizeMoments(value: unknown, duration: unknown) {
  if (!Array.isArray(value)) return value;
  const totalDuration = typeof duration === "number" ? duration : undefined;
  return value.slice(0, 3).map((moment) => {
    if (!moment || typeof moment !== "object") return moment;
    const item = moment as Record<string, unknown>;
    return {
      phase: getMomentPhase(item.time, totalDuration),
      type: item.type,
      intensity: item.intensity,
      visualCue: `${item.type || "变化"}带来画面张力、亮度或材质的变化`,
    };
  });
}

function sanitizeHints(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String).map(removeTimeMarkers);
}

function getPhaseLabel(index: number, total: number): string {
  if (total <= 1) return "overall";
  if (index === 0) return "opening";
  if (index === total - 1) return "ending";
  if (index < total / 2) return "early movement";
  if (index > total / 2) return "late movement";
  return "middle movement";
}

function getMomentPhase(time: unknown, duration?: number): string {
  if (typeof time !== "number" || !duration || duration <= 0) return "a salient change";
  const ratio = time / duration;
  if (ratio < 0.25) return "opening";
  if (ratio < 0.5) return "early movement";
  if (ratio < 0.75) return "middle movement";
  return "ending";
}

function removeTimeMarkers(text: string): string {
  return text
    .replace(/\d+(?:\.\d+)?-\d+(?:\.\d+)?秒/g, "某一段")
    .replace(/\d+(?:\.\d+)?秒附近/g, "某处")
    .replace(/\d+(?:\.\d+)?秒/g, "某处")
    .replace(/\d+(?:\.\d+)?-\d+(?:\.\d+)?s/gi, "one phase")
    .replace(/\d+(?:\.\d+)?s/gi, "one point");
}
