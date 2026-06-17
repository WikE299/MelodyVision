import { Character } from "../characters";

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
  };
  visualPreset: {
    style: string;
    mood: string;
    tone: string;
  };
}

export interface PromptDirectorBrief {
  coreEmotion: string;
  visualSubject: string;
  scene: string;
  composition: string;
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
    ]
      .filter(Boolean)
      .map(String)
      .join("；");

    if (musicContext) {
      prompt += `\n\n音频分析：${musicContext}`;
    }
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
      }
    : {};

  return {
    comments: commentSummary,
    userNote: userNote || "",
    musicAnalysis: musicContext,
    visualPreset: {
      style: presets.style || "水墨",
      mood: presets.mood || "宁静",
      tone: presets.tone || "淡雅",
    },
  };
}

export function buildPromptDirectorInstruction(input: PromptDirectorInput): string {
  return `You are Prompt Director for a music-to-image product.

Your job is to synthesize every musician comment, the user's personal note, the audio analysis, and the visual preset into standardized visual vocabulary for an image-generation model.

Hard rules:
1. User note has the highest priority for personal meaning.
2. Every musician comment must influence the visual plan. Do not drop any speaker.
3. Convert phrases into drawable visual terms: subject, setting, objects, motion, texture, palette, lighting, atmosphere, composition.
4. Audio analysis controls motion, density, contrast, brightness, and tension.
5. Visual preset controls final appearance, but must not erase the emotional core.
6. If inputs conflict, preserve the conflict visually, for example calm surface with hidden pressure.
7. Do not mention music, comments, BPM, musicians, analysis, or prompt in finalPrompt.
8. finalPrompt must be concrete and imageable, not abstract.
9. Avoid copyrighted game character names or exact franchise names in finalPrompt; translate them into visual traits instead.
10. Do not include any people, human figures, faces, bodies, portraits, silhouettes, crowds, or characters in the image.
11. Do not include any visible text, letters, captions, handwriting, signs, subtitles, logos, or watermarks in the image.
12. Return valid JSON only.

Input:
${JSON.stringify(input, null, 2)}

Return this exact JSON shape:
{
  "coreEmotion": "short English phrase",
  "visualSubject": "short English phrase",
  "scene": "short English phrase",
  "composition": "short English phrase",
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
}): string {
  return `${buildPromptDirectorInstruction(params.originalInput)}

Your previous output failed validation.

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
