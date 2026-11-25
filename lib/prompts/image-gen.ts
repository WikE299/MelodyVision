import type { Character } from "../characters/index.ts";
import type {
  ConversationState,
  MusicProfile,
  VisualBrief,
  VisualBriefFieldKey,
  VisualBriefFieldStatus,
} from "../contracts/index.ts";
import type { GenerationRole } from "../contracts/study-trial.ts";
import {
  buildVisualPresetPrompt,
  type VisualPresetPrompt,
} from "./visual-presets.ts";

export interface PromptDirectorInput {
  generationRole: GenerationRole;
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
  musicProfile: PromptDirectorMusicProfile | null;
  visualPreset: VisualPresetPrompt;
  humanPresence: HumanPresencePolicy;
  coCreation?: PromptDirectorCoCreationContext;
}

export type HumanPresenceMode = "none" | "implied" | "visible";
export type HumanPresenceCount = "single" | "pair" | "group";

export interface HumanPresencePolicy {
  mode: HumanPresenceMode;
  count: HumanPresenceCount;
  evidenceSourceIds: string[];
  evidenceExcerpts: string[];
  reason: string;
  framing: string;
  riskControls: string[];
}

export interface PromptDirectorMusicProfile {
  id: string;
  audio: MusicProfile["audio"];
  rhythm: Pick<MusicProfile["rhythm"], "bpm" | "beatStrength" | "onsetDensity">;
  tonality: Pick<MusicProfile["tonality"], "key" | "mode" | "harmonicStability">;
  dynamics: Pick<MusicProfile["dynamics"], "averageEnergy" | "dynamicComplexity">;
  timbre: MusicProfile["timbre"];
  sections: Array<Pick<MusicProfile["sections"][number], "id" | "phase" | "energy" | "brightness" | "onsetDensity" | "dynamicTrend" | "motions" | "textures">>;
  semantics: MusicProfile["semantics"];
  warnings: MusicProfile["warnings"];
}

export interface PromptDirectorCoCreationContext {
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

export function getPromptDirectorUserSourceIds(
  coCreation: PromptDirectorCoCreationContext
): string[] {
  return [...new Set(
    coCreation.sources
      .filter((source) => source.kind === "user-message")
      .map((source) => source.sourceId)
  )];
}

const HUMAN_REFERENCE_PATTERN = /(?:人物|人影|身影|背影|剪影|人群|一个人|两个人|几个人|一位(?:女孩|男孩|女性|男性|老人|少女|青年)|女孩|男孩|女人|男人|老人|孩子|儿童|母亲|父亲|母女|父子|父女|母子|情侣|夫妻|舞者|行人|旅人|面孔|人脸|双手|\bperson\b|\bpeople\b|\bhuman\b|\bfigure\b|\bwoman\b|\bman\b|\bgirl\b|\bboy\b|\bchild(?:ren)?\b|\bdancer\b|\bcouple\b|\bcrowd\b|\bsilhouette\b|\bportrait\b|\bface\b)/i;
const HUMAN_EXCLUSION_PATTERN = /(?:不要|不想|不需要|避免|排除|禁止|不能|没有|无)(?:让|有|出现|加入|添加|画出|展示)?[^。；，,.!?]{0,16}(?:人物|人影|身影|背影|剪影|人群|一个人|人脸|面孔|女孩|男孩|女人|男人|孩子|人(?!工|声|性|机))|(?:no|without|avoid|exclude|remove|do not (?:show|include|add))[^.!?,;]{0,24}(?:people|person|human|figure|face|portrait|character|crowd)/i;
const HUMAN_IMPLIED_PATTERN = /(?:人影|身影|背影|剪影|模糊的人|远处的?人|人物轮廓|distant (?:human )?figure|back[- ]view|from behind|silhouette|shadowy figure|human outline)/i;
const HUMAN_EXPLICIT_FACE_PATTERN = /(?:清晰(?:的)?(?:人脸|面孔|五官)|正脸|面部特写|肖像|直视镜头|close[- ]up (?:face|portrait)|clear face|facing (?:the )?camera|frontal portrait)/i;
const HUMAN_VISIBLE_PATTERN = /(?:人物|人群|一个人(?!影)|两个人|几个人|一位(?:女孩|男孩|女性|男性|老人|少女|青年)|女孩|男孩|女人|男人|老人|孩子|儿童|母亲|父亲|母女|父子|父女|母子|情侣|夫妻|舞者|行人|旅人|\bperson\b|\bpeople\b|\bhuman\b|\bwoman\b|\bman\b|\bgirl\b|\bboy\b|\bchild(?:ren)?\b|\bdancer\b|\bcouple\b|\bcrowd\b|\bportrait\b)/i;
const HUMAN_PAIR_PATTERN = /(?:两个人|两人|情侣|夫妻|母女|父子|一对|\btwo (?:people|figures|persons)\b|\bcouple\b|\bpair\b)/i;
const HUMAN_GROUP_PATTERN = /(?:人群|众人|许多人|一群人|多人|\bcrowd\b|\bgroup of people\b|\bmany people\b)/i;

function hasHumanReference(value: string): boolean {
  return HUMAN_REFERENCE_PATTERN.test(value);
}

function classifyHumanText(value: string): HumanPresenceMode | null {
  if (!value.trim() || HUMAN_EXCLUSION_PATTERN.test(value)) return null;
  if (HUMAN_EXPLICIT_FACE_PATTERN.test(value)) return "visible";
  if (HUMAN_IMPLIED_PATTERN.test(value)) return "implied";
  if (HUMAN_VISIBLE_PATTERN.test(value)) return "visible";
  return null;
}

function extractLatestHumanDirective(value: string): {
  excluded: boolean;
  mode: HumanPresenceMode | null;
} | null {
  let latest: { excluded: boolean; mode: HumanPresenceMode | null } | null = null;
  const clauses = value.split(/(?:[。；，,.!?\n]+|但是|不过|然而|改成|还是)/).filter(Boolean);
  for (const clause of clauses) {
    const excluded = HUMAN_EXCLUSION_PATTERN.test(clause);
    const mode = classifyHumanText(clause);
    if (excluded || mode) latest = { excluded, mode };
  }
  return latest;
}

function inferHumanCount(value: string): HumanPresenceCount {
  if (HUMAN_GROUP_PATTERN.test(value)) return "group";
  if (HUMAN_PAIR_PATTERN.test(value)) return "pair";
  return "single";
}

function resolveFieldUserSourceIds(
  fieldSourceIds: string[],
  coCreation?: PromptDirectorCoCreationContext
): string[] {
  if (!coCreation) return [];
  const sources = new Map(coCreation.sources.map((source) => [source.id, source]));
  return [...new Set(fieldSourceIds
    .map((sourceId) => sources.get(sourceId))
    .filter((source) => source?.kind === "user-message")
    .map((source) => source!.sourceId))];
}

export function inferHumanPresencePolicy(params: {
  generationRole: GenerationRole;
  userNote?: string;
  coCreation?: PromptDirectorCoCreationContext;
}): HumanPresencePolicy {
  const none = (
    reason: string,
    evidenceSourceIds: string[] = [],
    evidenceExcerpts: string[] = []
  ): HumanPresencePolicy => ({
    mode: "none",
    count: "single",
    evidenceSourceIds,
    evidenceExcerpts,
    reason,
    framing: "environment-only",
    riskControls: ["Do not introduce people without confirmed user evidence."],
  });

  if (params.generationRole === "direct_baseline") {
    return none("Direct baseline has no user-authorized human evidence.");
  }

  const coCreation = params.coCreation;
  const mustAvoid = coCreation?.visualBrief.fields.find((field) => field.field === "mustAvoid");
  const mustAvoidText = mustAvoid
    ? (Array.isArray(mustAvoid.value) ? mustAvoid.value.join(" ") : mustAvoid.value)
    : "";
  if (mustAvoidText && hasHumanReference(mustAvoidText)) {
    return none(
      "The user-backed VisualBrief explicitly excludes human presence.",
      resolveFieldUserSourceIds(mustAvoid?.sourceIds || [], coCreation),
      [mustAvoidText]
    );
  }

  const rawUserSources = new Map<string, string>();
  for (const source of coCreation?.sources || []) {
    if (source.kind === "user-message") rawUserSources.set(source.sourceId, source.excerpt);
  }
  if (rawUserSources.size === 0 && params.userNote?.trim()) {
    params.userNote.split(/\n+/).filter(Boolean).forEach((excerpt, index) => {
      rawUserSources.set(`user-note-${index + 1}`, excerpt.trim());
    });
  }

  const directives = [...rawUserSources.entries()]
    .map(([sourceId, excerpt]) => {
      const directive = extractLatestHumanDirective(excerpt);
      return {
        sourceId,
        excerpt,
        excluded: directive?.excluded || false,
        mode: directive?.mode || null,
      };
    })
    .filter((item) => item.excluded || item.mode);
  const latestDirective = directives[directives.length - 1];

  if (!latestDirective) {
    return none("No explicit user-authored human presence was found.");
  }
  if (latestDirective.excluded || !latestDirective.mode) {
    return none(
      "The user's latest human-related instruction excludes people.",
      [latestDirective.sourceId],
      [latestDirective.excerpt]
    );
  }

  const relevant = directives.filter((item) => item.mode && !item.excluded);
  const evidenceSourceIds = relevant.map((item) => item.sourceId);
  const evidenceExcerpts = relevant.map((item) => item.excerpt);
  const combinedEvidence = evidenceExcerpts.join(" ");
  const mode = latestDirective.mode;
  const count = inferHumanCount(combinedEvidence);

  return {
    mode,
    count,
    evidenceSourceIds,
    evidenceExcerpts,
    reason: mode === "implied"
      ? "The user explicitly requested a distant, obscured, or implied human presence."
      : "The user explicitly requested a visible human subject.",
    framing: mode === "implied"
      ? "distant, back-view, silhouette, or environmentally obscured"
      : count === "group"
        ? "wide environmental shot"
        : "medium or wide shot unless the user explicitly requests a close portrait",
    riskControls: mode === "implied"
      ? ["Keep faces unreadable.", "Keep hands small, hidden, or outside the focal area.", "Avoid complex poses."]
      : ["Use anatomically stable poses.", "Avoid unnecessary hand prominence or interlocked limbs.", "Keep the requested people count exact."],
  };
}

export function buildHumanPresenceInstruction(policy: HumanPresencePolicy): string {
  if (policy.mode === "none") {
    return "Do not include people, human figures, faces, bodies, portraits, silhouettes, crowds, or characters. Human presence may be suggested only through environmental traces such as an empty chair or footprints.";
  }
  if (policy.mode === "implied") {
    return `Human presence is authorized only by user evidence (${policy.evidenceSourceIds.join(", ")}). Include ${policy.count === "single" ? "one" : policy.count === "pair" ? "two" : "a small group of"} distant or obscured human ${policy.count === "single" ? "figure" : "figures"}, using ${policy.framing} framing. Keep faces unreadable, keep hands hidden or visually minor, and avoid complex poses. Do not make the figure more prominent than the user's description.`;
  }
  return `Visible human presence is authorized by user evidence (${policy.evidenceSourceIds.join(", ")}). Preserve the requested ${policy.count} human subject faithfully. Use ${policy.framing}; prefer natural, anatomically stable poses and avoid unnecessary hand, finger, or interlocked-limb complexity. Musician comments may refine atmosphere or pose but may not add extra people.`;
}

export function buildHumanPresenceNegativePrompt(policy: HumanPresencePolicy): string {
  const common = ["text", "letters", "caption", "logo", "watermark", "signature", "blurry", "low quality"];
  if (policy.mode === "none") {
    return ["people", "human figure", "face", "portrait", "silhouette", "character", "crowd", ...common].join(", ");
  }
  const anatomy = ["deformed face", "deformed hands", "extra fingers", "missing fingers", "fused fingers", "malformed limbs", "extra limbs", "duplicate body", "disconnected limbs", "unnatural anatomy"];
  if (policy.mode === "implied") {
    return ["close-up face", "detailed hands", "complex pose", ...(policy.count === "group" ? [] : ["crowd"]), ...anatomy, ...common].join(", ");
  }
  return [...(policy.count === "group" ? [] : ["crowd"]), ...anatomy, ...common].join(", ");
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

const IP_REFERENCE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bTom\s*(?:and|&)\s*Jerry\b/gi, "a playful slapstick chase rhythm"],
  [/猫和老鼠/g, "a playful slapstick chase rhythm"],
  [/\bTom(?:\s+the)?\s+Cat\b/gi, "a blue-gray ribbon sculpture"],
  [/汤姆猫/g, "a blue-gray ribbon sculpture"],
  [/\bPlants\s+vs\.?\s+Zombies\b/gi, "a whimsical botanical defense tableau"],
  [/植物大战僵尸/g, "a whimsical botanical defense tableau"],
];

export function sanitizeImagePromptForProvider(prompt: string): string {
  const withoutKnownReferences = IP_REFERENCE_REPLACEMENTS.reduce(
    (value, [pattern, replacement]) => value.replace(pattern, replacement),
    prompt
  );

  return withoutKnownReferences
    .replace(
      /\b(?:in the style of|styled after|imitating)\s+[^,.;]+/gi,
      "with an original visual language"
    )
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
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
  },
  generationRole: GenerationRole = "co_created"
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

  const coCreationContext = buildPromptDirectorCoCreationContext(coCreation);

  return {
    generationRole,
    comments: commentSummary,
    userNote: userNote || "",
    musicAnalysis: musicContext,
    musicProfile: buildPromptDirectorMusicProfile(coCreation?.musicProfile),
    visualPreset: buildVisualPresetPrompt(presets),
    humanPresence: inferHumanPresencePolicy({
      generationRole,
      userNote,
      coCreation: coCreationContext,
    }),
    coCreation: coCreationContext,
  };
}

function buildPromptDirectorMusicProfile(
  musicProfile?: MusicProfile | null
): PromptDirectorMusicProfile | null {
  if (!musicProfile) return null;

  return {
    id: musicProfile.id,
    audio: musicProfile.audio,
    rhythm: {
      bpm: musicProfile.rhythm.bpm,
      beatStrength: musicProfile.rhythm.beatStrength,
      onsetDensity: musicProfile.rhythm.onsetDensity,
    },
    tonality: {
      key: musicProfile.tonality.key,
      mode: musicProfile.tonality.mode,
      harmonicStability: musicProfile.tonality.harmonicStability,
    },
    dynamics: {
      averageEnergy: musicProfile.dynamics.averageEnergy,
      dynamicComplexity: musicProfile.dynamics.dynamicComplexity,
    },
    timbre: musicProfile.timbre,
    sections: musicProfile.sections.slice(0, 8).map((section) => ({
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
      moods: musicProfile.semantics.moods.slice(0, 5),
      genres: musicProfile.semantics.genres.slice(0, 5),
      instruments: musicProfile.semantics.instruments.slice(0, 5),
      textures: musicProfile.semantics.textures.slice(0, 5),
      motions: musicProfile.semantics.motions.slice(0, 5),
      spaces: musicProfile.semantics.spaces.slice(0, 5),
    },
    warnings: musicProfile.warnings,
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

  return {
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
  const humanPresenceInstruction = buildHumanPresenceInstruction(input.humanPresence);
  const requiredNegativePrompt = buildHumanPresenceNegativePrompt(input.humanPresence);
  const coCreationRules = input.coCreation
    ? `
Version 2 co-creation rules:
- coCreation.visualBrief is the authoritative visual plan. Do not replace it with a new concept.
- Every distinct sourceId among coCreation.sources items with kind=user-message is independent primary evidence. Preserve each exact sourceId once in userSourceMappings even if the Visual Scribe did not promote it into a VisualBrief field.
- Preserve every present VisualBrief field in visualBriefMappings exactly once, including its field, status, and sourceIds.
- sourceIds in visualBriefMappings must be copied exactly from that field. Never invent or remove a source.
- A confirmed field, especially one backed by a user-message source, uses primary priority and must control the focal subject, personal meaning, composition, palette, or lighting as applicable.
- mustInclude and mustAvoid always use constraint priority, even when their status is confirmed. Suggested and conflicted descriptive fields use supporting priority.
- A suggested field may enrich secondary detail. A conflicted field must remain visibly unresolved rather than being silently collapsed.
- mustInclude and mustAvoid are hard constraints. personalMeaning is the emotional center.
- MusicProfile supplies motion, density, dynamics, timbre, and structural evidence. It cannot override confirmed user fields.
- Keep every input comment exactly once in weightingRationale and copy its numeric weight exactly. Never promote an unselected resonance weight.
- The legacy comments and userNote below are supporting context for source interpretation; do not use them to contradict the VisualBrief.
`
    : "";
  const baselineRules = input.generationRole === "direct_baseline"
    ? `
Direct baseline rules:
- This is a music-only reference condition. Use musicProfile and musicAnalysis as the only semantic sources.
- comments, userNote, coCreation, resonance, and visual presets chosen through dialogue are unavailable by design. Do not infer or fabricate them.
- Return empty arrays for sourceMappings, userSourceMappings, visualBriefMappings, and weightingRationale.
- Build a concrete visual subject from rhythm, dynamics, timbre, structure, motion, and texture evidence in musicProfile and musicAnalysis.
`
    : "";

  return `You are Prompt Director for a music-to-image product.

Your job is to act as a visual creative director and reliability agent. First build a concise visual plan that faithfully translates the source material, then write the image-generation prompt. The selected visual preset provides production constraints, not a reusable scene template.
${coCreationRules}
${baselineRules}

Hard rules:
1. In co-created runs, user note has the highest priority for personal meaning. In direct baseline runs, use only musicProfile and musicAnalysis.
2. In co-created runs, every musician or guide comment must influence the visual plan. Do not drop any speaker, and preserve each characterId exactly in sourceMappings. In direct baseline runs sourceMappings must be empty.
3. In co-created runs, treat comment.weight as the user's co-creation signal. This rule does not apply to direct baseline runs.
4. Convert phrases into drawable visual terms: subject, setting, objects, motion, texture, palette, lighting, atmosphere, composition. Do not simply quote or summarize the comments.
5. Audio analysis may guide motion, density, contrast, brightness, material texture, rhythm contour, and visual tension. If musicAnalysis.degraded=true, treat it only as an approximate low-level signal and rely primarily on musician comments and the user note. If it is rich, semanticCandidates are still low-weight hypotheses and may be ignored when they conflict with signal evidence. Never treat a tonalityCandidate as a verified musical fact.
6. Treat visualPreset.stylePrompt, moodPrompt, and tonePrompt as hard production constraints. Integrate them into finalPrompt naturally. "自动" means you must make a deliberate choice from this specific source material, not reuse a default.
7. If inputs conflict, preserve the conflict visually, for example calm surface with hidden pressure.
8. Do not mention music, comments, BPM, musicians, analysis, or prompt in finalPrompt.
9. finalPrompt must be concrete and imageable, not abstract.
10. Do not use names or titles from existing films, television, games, comics, characters, franchises, brands, studios, or artists in finalPrompt or any visual translation. Convert every such reference into generic drawable traits, motion, material, palette, and composition.
11. ${humanPresenceInstruction}
12. Do not include any visible text, letters, captions, handwriting, signs, subtitles, logos, or watermarks in the image.
13. Choose a visualDomain before writing finalPrompt. Consider objects, interiors, architecture, natural phenomena, still life, material studies, geometric space, microscopic worlds, surreal environments, machines, weather systems, or ceremonial spaces as appropriate.
14. Do not default to mountains, rivers, mist, bamboo, moonlight, bridges, or generic tranquil landscapes unless those motifs are directly justified by the inputs.
15. The medium describes how the image is made; it must not dictate what the image depicts. An ink painting does not automatically require a landscape.
16. Commit to one clear focal subject and one distinctive compositional idea. Avoid generic collections of poetic motifs.
17. finalPrompt must faithfully compose every source available for the current generationRole. If userNote is empty, userNoteTrace must say "none".
18. If detailed audio evidence exists, at least one concrete visual decision must come from the strongest phase or a salient change.
19. Return valid JSON only.
20. Keep exclusions out of finalPrompt. Put forbidden subjects and visible text constraints in negativePrompt only; finalPrompt itself must not contain the words used to name those exclusions. Human terms are allowed in finalPrompt only when humanPresence.mode is implied or visible.

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
      "sourceId": "exact sourceId of a coCreation source whose kind is user-message",
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
      "weight": 1,
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
  "negativePrompt": "comma-separated English negative prompt; it must include these policy-specific safeguards: ${requiredNegativePrompt}"
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
Keep every distinct sourceId from coCreation user-message sources exactly once in userSourceMappings with primary priority.
Use constraint priority for mustInclude and mustAvoid, primary for other confirmed fields, and supporting for suggested or conflicted fields.
Make userNoteTrace concrete when userNote is present.
Do not remove any musician's influence.
Keep every input comment exactly once in weightingRationale and copy comment.weight exactly.
Do not include forbidden meta words in finalPrompt.
Remove every film, television, game, comic, character, franchise, brand, studio, and artist name from finalPrompt and all visual translations. Preserve only generic drawable traits.
Apply the exact humanPresence policy from the input. Do not add a person when mode is none, and do not remove the user-authorized person when mode is implied or visible. Never include visible text in finalPrompt.`;
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
