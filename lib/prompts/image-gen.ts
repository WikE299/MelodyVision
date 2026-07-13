import type { Character } from "../characters/index.ts";
import type {
  ConversationState,
  MusicProfile,
  VisualBrief,
  VisualBriefFieldKey,
  VisualBriefFieldStatus,
} from "../contracts/index.ts";
import {
  buildVisualPresetPrompt,
  type VisualPresetPrompt,
} from "./visual-presets.ts";

export interface PromptDirectorInput {
  comments: Array<{
    characterId: string;
    speaker: string;
    comment: string;
    weight: number;
    userResonance: boolean;
  }>;
  userNote: string;
  musicAnalysis: {
    analysisEngine?: unknown;
    degraded?: unknown;
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
    sourceMetadata?: unknown;
    tonalityCandidate?: unknown;
    semanticCandidates?: unknown;
    analysisWarnings?: unknown;
  };
  visualPreset: VisualPresetPrompt;
  coCreation?: PromptDirectorCoCreationContext;
}

export interface PromptDirectorCoCreationContext {
  musicProfile: {
    id: string;
    audio: MusicProfile["audio"];
    rhythm: Pick<MusicProfile["rhythm"], "bpm" | "beatStrength" | "onsetDensity">;
    tonality: Pick<MusicProfile["tonality"], "key" | "mode" | "harmonicStability">;
    dynamics: Pick<MusicProfile["dynamics"], "averageEnergy" | "dynamicComplexity">;
    timbre: MusicProfile["timbre"];
    sections: Array<Pick<MusicProfile["sections"][number], "id" | "phase" | "energy" | "brightness" | "onsetDensity" | "dynamicTrend" | "motions" | "textures">>;
    semantics: MusicProfile["semantics"];
    warnings: MusicProfile["warnings"];
  } | null;
  visualBrief: {
    id: string;
    version: number;
    status: VisualBrief["status"];
    readiness: VisualBrief["readiness"];
    fields: Array<{
      field: VisualBriefFieldKey;
      value: string | string[];
      status: VisualBriefFieldStatus;
      sourceIds: string[];
    }>;
  };
  sources: Array<{
    id: string;
    kind: string;
    sourceId: string;
    speakerId?: string;
    excerpt: string;
  }>;
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
  userSourceMappings?: Array<{
    sourceId: string;
    priority: "primary" | "constraint";
    visualTranslation: string;
  }>;
  visualBriefMappings?: Array<{
    field: VisualBriefFieldKey;
    status: VisualBriefFieldStatus;
    sourceIds: string[];
    priority: "primary" | "supporting" | "constraint";
    visualTranslation: string;
  }>;
  weightingRationale?: Array<{
    characterId: string;
    weight: number;
    reason: string;
    visualImpact: string;
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
    const musicContext = formatPromptMusicContext(musicAnalysis);

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
  comments: { characterId: string; text: string; weight?: number; userResonance?: boolean }[],
  presets: {
    style?: string;
    mood?: string;
    tone?: string;
  },
  userNote?: string,
  musicAnalysis?: Record<string, unknown>,
  coCreation?: {
    musicProfile?: MusicProfile | null;
    visualBrief?: VisualBrief | null;
    conversationState?: ConversationState | null;
  }
): PromptDirectorInput {
  const commentSummary = comments.map((comment) => {
    const character = characters.find((ch) => ch.id === comment.characterId);
    return {
      characterId: comment.characterId,
      speaker: character?.name || comment.characterId,
      comment: comment.text,
      weight: normalizeCommentWeight(comment.weight),
      userResonance: Boolean(comment.userResonance),
    };
  });
  const musicContext = musicAnalysis
    ? {
        analysisEngine: musicAnalysis.analysisEngine,
        degraded: musicAnalysis.degraded,
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
        sourceMetadata: musicAnalysis.sourceMetadata,
        tonalityCandidate: musicAnalysis.tonalityCandidate,
        semanticCandidates: musicAnalysis.semanticCandidates,
        analysisWarnings: musicAnalysis.analysisWarnings,
      }
    : {};

  return {
    comments: commentSummary,
    userNote: userNote || "",
    musicAnalysis: musicContext,
    visualPreset: buildVisualPresetPrompt(presets),
    coCreation: buildPromptDirectorCoCreationContext(coCreation),
  };
}

function buildPromptDirectorCoCreationContext(
  input?: {
    musicProfile?: MusicProfile | null;
    visualBrief?: VisualBrief | null;
    conversationState?: ConversationState | null;
  }
): PromptDirectorCoCreationContext | undefined {
  const visualBrief = input?.visualBrief;
  const conversationState = input?.conversationState;
  if (!visualBrief || !conversationState) return undefined;

  const messages = new Map(conversationState.messages.map((message) => [message.id, message]));
  const fieldEntries = Object.entries(visualBrief.fields) as Array<[
    VisualBriefFieldKey,
    VisualBrief["fields"][VisualBriefFieldKey],
  ]>;
  const fields = fieldEntries
    .filter(([, field]) => field.status !== "missing" && field.value !== null)
    .map(([field, value]) => ({
      field,
      value: value.value as string | string[],
      status: value.status,
      sourceIds: value.sources.map((source) => source.id),
    }));
  const sourceMap = new Map<string, PromptDirectorCoCreationContext["sources"][number]>();

  for (const [, field] of fieldEntries) {
    for (const source of field.sources) {
      const message = messages.get(source.sourceId);
      sourceMap.set(source.id, {
        id: source.id,
        kind: source.kind,
        sourceId: source.sourceId,
        speakerId: message?.speakerId,
        excerpt: source.excerpt || message?.content || "MusicProfile evidence",
      });
    }
  }
  for (const message of conversationState.messages) {
    if (message.role !== "user") continue;
    sourceMap.set(message.id, {
      id: message.id,
      kind: "user-message",
      sourceId: message.id,
      speakerId: message.speakerId,
      excerpt: message.content,
    });
  }

  const musicProfile = input?.musicProfile
    ? {
        id: input.musicProfile.id,
        audio: input.musicProfile.audio,
        rhythm: {
          bpm: input.musicProfile.rhythm.bpm,
          beatStrength: input.musicProfile.rhythm.beatStrength,
          onsetDensity: input.musicProfile.rhythm.onsetDensity,
        },
        tonality: {
          key: input.musicProfile.tonality.key,
          mode: input.musicProfile.tonality.mode,
          harmonicStability: input.musicProfile.tonality.harmonicStability,
        },
        dynamics: {
          averageEnergy: input.musicProfile.dynamics.averageEnergy,
          dynamicComplexity: input.musicProfile.dynamics.dynamicComplexity,
        },
        timbre: input.musicProfile.timbre,
        sections: input.musicProfile.sections.slice(0, 8).map((section) => ({
          id: section.id,
          phase: section.phase,
          energy: section.energy,
          brightness: section.brightness,
          onsetDensity: section.onsetDensity,
          dynamicTrend: section.dynamicTrend,
          motions: section.motions.slice(0, 3),
          textures: section.textures.slice(0, 3),
        })),
        semantics: {
          moods: input.musicProfile.semantics.moods.slice(0, 5),
          genres: input.musicProfile.semantics.genres.slice(0, 5),
          instruments: input.musicProfile.semantics.instruments.slice(0, 5),
          textures: input.musicProfile.semantics.textures.slice(0, 5),
          motions: input.musicProfile.semantics.motions.slice(0, 5),
          spaces: input.musicProfile.semantics.spaces.slice(0, 5),
        },
        warnings: input.musicProfile.warnings,
      }
    : null;

  return {
    musicProfile,
    visualBrief: {
      id: visualBrief.id,
      version: visualBrief.version,
      status: visualBrief.status,
      readiness: visualBrief.readiness,
      fields,
    },
    sources: [...sourceMap.values()],
  };
}

function normalizeCommentWeight(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  return Math.max(0.5, Math.min(2.5, Math.round(value * 10) / 10));
}

export function buildPromptDirectorInstruction(input: PromptDirectorInput): string {
  const coCreationRules = input.coCreation
    ? `
Version 2 co-creation rules:
- coCreation.visualBrief is the authoritative visual plan. Do not replace it with a new concept.
- Every coCreation.sources item with kind=user-message is independent primary evidence. Preserve each exact source id once in userSourceMappings even if the Visual Scribe did not promote it into a VisualBrief field.
- Preserve every present VisualBrief field in visualBriefMappings exactly once, including its field, status, and sourceIds.
- sourceIds in visualBriefMappings must be copied exactly from that field. Never invent or remove a source.
- A confirmed field, especially one backed by a user-message source, uses primary priority and must control the focal subject, personal meaning, composition, palette, or lighting as applicable.
- mustInclude and mustAvoid always use constraint priority, even when their status is confirmed. Suggested and conflicted descriptive fields use supporting priority.
- A suggested field may enrich secondary detail. A conflicted field must remain visibly unresolved rather than being silently collapsed.
- mustInclude and mustAvoid are hard constraints. personalMeaning is the emotional center.
- MusicProfile supplies motion, density, dynamics, timbre, and structural evidence. It cannot override confirmed user fields.
- The legacy comments and userNote below are supporting context for source interpretation; do not use them to contradict the VisualBrief.
`
    : "";

  return `You are Prompt Director for a music-to-image product.

Your job is to act as a visual creative director and reliability agent. First build a concise visual plan that faithfully translates the source material, then write the image-generation prompt. The selected visual preset provides production constraints, not a reusable scene template.
${coCreationRules}

Hard rules:
1. User note has the highest priority for personal meaning.
2. Every musician comment must influence the visual plan. Do not drop any speaker, and preserve each characterId exactly in sourceMappings.
3. Treat comment.weight as the user's co-creation signal. Comments with userResonance=true or higher weight must have stronger influence on coreEmotion, visualSubject, composition, or the main focal tension. Lower-weight comments should still shape secondary materials, lighting, edges, atmosphere, or supporting symbols.
4. Convert phrases into drawable visual terms: subject, setting, objects, motion, texture, palette, lighting, atmosphere, composition. Do not simply quote or summarize the comments.
5. Audio analysis may guide motion, density, contrast, brightness, material texture, rhythm contour, and visual tension. If musicAnalysis.degraded=true, treat it only as an approximate low-level signal and rely primarily on musician comments and the user note. If it is rich, semanticCandidates are still low-weight hypotheses and may be ignored when they conflict with signal evidence. Never treat a tonalityCandidate as a verified musical fact.
6. Treat visualPreset.stylePrompt, moodPrompt, and tonePrompt as hard production constraints. Integrate them into finalPrompt naturally. "自动" means you must make a deliberate choice from this specific source material, not reuse a default.
7. If inputs conflict, preserve the conflict visually, for example calm surface with hidden pressure.
8. Do not mention music, comments, BPM, musicians, analysis, or prompt in finalPrompt.
9. finalPrompt must be concrete and imageable, not abstract.
10. Avoid copyrighted game character names or exact franchise names in finalPrompt; translate them into visual traits instead.
11. Do not include any people, human figures, faces, bodies, portraits, silhouettes, crowds, or characters in the image.
12. Do not include any visible text, letters, captions, handwriting, signs, subtitles, logos, or watermarks in the image.
13. Choose a visualDomain before writing finalPrompt. Consider objects, interiors, architecture, natural phenomena, still life, material studies, geometric space, microscopic worlds, surreal environments, machines, weather systems, or ceremonial spaces as appropriate.
14. Do not default to mountains, rivers, mist, bamboo, moonlight, bridges, or generic tranquil landscapes unless those motifs are directly justified by the inputs.
15. The medium describes how the image is made; it must not dictate what the image depicts. An ink painting does not automatically require a landscape.
16. Commit to one clear focal subject and one distinctive compositional idea. Avoid generic collections of poetic motifs.
17. finalPrompt must be a true composite of music traits, musician comments, user note, and user resonance weights. If userNote is empty, userNoteTrace must say "none".
18. If detailed audio evidence exists, at least one concrete visual decision must come from the strongest phase or a salient change.
19. Return valid JSON only.

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
  "userSourceMappings": [
    {
      "sourceId": "exact id of a coCreation source whose kind is user-message",
      "priority": "primary",
      "visualTranslation": "specific drawable contribution from this user message"
    }
  ],
  "visualBriefMappings": [
    {
      "field": "exact VisualBrief field name",
      "status": "exact field status",
      "sourceIds": ["exact source reference id from that field"],
      "priority": "primary|supporting|constraint",
      "visualTranslation": "specific drawable use of this field"
    }
  ],
  "weightingRationale": [
    {
      "characterId": "exact characterId from input",
      "weight": 1.8,
      "reason": "why this input has this influence, including whether userResonance is true",
      "visualImpact": "how the weight changes subject, composition, lighting, material, or atmosphere"
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
When Version 2 coCreation input exists, keep every present VisualBrief field exactly once in visualBriefMappings with the exact status and sourceIds.
Keep every coCreation user-message source exactly once in userSourceMappings with primary priority.
Use constraint priority for mustInclude and mustAvoid, primary for other confirmed fields, and supporting for suggested or conflicted fields.
Make userNoteTrace concrete when userNote is present.
Do not remove any musician's influence.
Preserve the weighting hierarchy from comment.weight and userResonance.
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

function formatPromptMusicContext(musicAnalysis: Record<string, unknown>): string {
  const degraded = musicAnalysis.degraded === true;
  const values = degraded
    ? [
        "approximate degraded signal",
        musicAnalysis.tempo,
        musicAnalysis.energy,
        musicAnalysis.brightness,
      ]
    : [
        "rich analysis with low-weight semantic candidates",
        musicAnalysis.description,
        musicAnalysis.tempo,
        musicAnalysis.mood,
        musicAnalysis.energy,
        musicAnalysis.brightness,
        formatCompactMusicEvidence(musicAnalysis),
      ];
  return values.filter(Boolean).map(String).join("；");
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
