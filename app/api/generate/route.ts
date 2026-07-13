import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  formatCompactMusicEvidence,
  buildPromptDirectorInput,
  buildPromptDirectorInstruction,
  buildPromptDirectorRepairInstruction,
  PromptDirectorBrief,
  PromptDirectorInput,
} from "@/lib/prompts/image-gen";
import { callPromptDirector, callPromptDirectorRepair, PromptDirectorResult } from "@/lib/llm";
import { characters } from "@/lib/characters";
import { buildVisualPresetPrompt } from "@/lib/prompts/visual-presets";
import { insertGenerationRun } from "@/lib/db/generation-runs";
import type { ConversationState, MusicProfile, VisualBrief } from "@/lib/contracts";
import { parseConversationState } from "@/lib/conversation";
import { parseVisualBrief } from "@/lib/visual-brief";

export const runtime = "nodejs";

interface CommentInput {
  characterId: string;
  text: string;
  weight: number;
  userResonance: boolean;
}

interface DashScopeImageItem {
  image?: string;
}

interface DashScopeResponse {
  request_id?: string;
  code?: string;
  message?: string;
  output?: {
    choices?: Array<{
      message?: {
        content?: DashScopeImageItem[];
      };
    }>;
  };
  usage?: unknown;
}

interface SavedImage {
  localPath: string;
  publicUrl: string;
  bytes: number;
  contentType: string;
}

interface PromptDirectorValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

interface PromptDirectorStep {
  label: "initial" | "repair";
  rawOutput: string;
  parsed: PromptDirectorBrief | null;
  validation: PromptDirectorValidation;
  meta: {
    model: string;
    finishReason: string | null;
    usage?: PromptDirectorResult["usage"];
    parseStatus: "ok" | "invalid-json";
  };
}

const PROMPT_DIRECTOR_MAX_REPAIRS = 1;
const DEFAULT_IMAGE_SIZE = "1696*960";
const LANDSCAPE_FORMAT_CONSTRAINT =
  "Compose for a wide 16:9 horizontal canvas. Use the width intentionally with a clear focal subject, readable foreground-to-background depth, and meaningful negative space; avoid a square composition placed inside the wide frame.";

function getConfiguredImageSize(): string {
  const configured = process.env.IMAGE_SIZE?.trim();
  return configured && /^\d+\*\d+$/.test(configured) ? configured : DEFAULT_IMAGE_SIZE;
}

function appendLandscapeFormatConstraint(prompt: string): string {
  const cleaned = prompt.trim();
  return cleaned.includes(LANDSCAPE_FORMAT_CONSTRAINT)
    ? cleaned
    : `${cleaned} ${LANDSCAPE_FORMAT_CONSTRAINT}`;
}

function normalizeCommentWeight(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  return Math.max(0.5, Math.min(2.5, Math.round(value * 10) / 10));
}

function normalizeCommentWeights(value: unknown): Record<string, { resonance: boolean; weight: number }> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).map(([characterId, raw]) => {
      const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
      const resonance = Boolean(item.resonance);
      return [
        characterId,
        {
          resonance,
          weight: normalizeCommentWeight(item.weight ?? (resonance ? 1.8 : 1)),
        },
      ];
    })
  );
}

function normalizeComments(
  comments: unknown,
  commentWeights: Record<string, { resonance: boolean; weight: number }> = {}
): CommentInput[] {
  if (Array.isArray(comments)) {
    return comments
      .map((comment) => {
        if (
          comment &&
          typeof comment === "object" &&
          "characterId" in comment &&
          "text" in comment
        ) {
          const characterId = String(comment.characterId);
          const inlineWeight = "weight" in comment ? (comment as { weight?: unknown }).weight : undefined;
          const inlineResonance = "userResonance" in comment ? (comment as { userResonance?: unknown }).userResonance : undefined;
          const savedWeight = commentWeights[characterId];
          const userResonance = Boolean(inlineResonance ?? savedWeight?.resonance);
          return {
            characterId,
            text: String(comment.text),
            weight: normalizeCommentWeight(inlineWeight ?? savedWeight?.weight ?? (userResonance ? 1.8 : 1)),
            userResonance,
          };
        }
        return null;
      })
      .filter(Boolean) as CommentInput[];
  }

  if (comments && typeof comments === "object") {
    return Object.entries(comments).map(([characterId, text]) => ({
      characterId,
      text: String(text),
      weight: commentWeights[characterId]?.weight || 1,
      userResonance: Boolean(commentWeights[characterId]?.resonance),
    }));
  }

  return [];
}

function buildFallbackImagePrompt(
  comments: CommentInput[],
  presets: { style?: string; mood?: string; tone?: string },
  userNote?: string,
  musicAnalysis?: Record<string, unknown>,
  directorInput?: PromptDirectorInput
): string {
  const sourceFragments = [...comments]
    .sort((a, b) => b.weight - a.weight)
    .map((comment) => comment.text.trim())
    .filter(Boolean)
    .join(" / ");
  const musicContext = musicAnalysis
    ? musicAnalysis.degraded === true
      ? [
          "approximate degraded signal",
          musicAnalysis.tempo,
          musicAnalysis.energy,
          musicAnalysis.brightness,
        ]
          .filter(Boolean)
          .map(String)
          .join(" / ")
      : [
          "rich analysis with low-weight semantic candidates",
          musicAnalysis.description,
          musicAnalysis.tempo,
          musicAnalysis.mood,
          musicAnalysis.energy,
          musicAnalysis.brightness,
          formatCompactMusicEvidence(musicAnalysis),
        ]
          .filter(Boolean)
          .map(String)
          .join(" / ")
    : "";

  return [
    "Create one distinctive visual concept with a clear focal subject. Do not default to a generic landscape.",
    directorInput?.coCreation
      ? `Treat these co-created fields as authoritative: ${directorInput.coCreation.visualBrief.fields
          .map((field) => `${field.field}=${Array.isArray(field.value) ? field.value.join(" / ") : field.value} [${field.status}]`)
          .join("; ")}.`
      : "",
    `Use the following source impressions as mandatory visual anchors: ${sourceFragments}.`,
    comments.some((comment) => comment.userResonance)
      ? `Give strongest visual priority to the user-resonant impressions from: ${comments.filter((comment) => comment.userResonance).map((comment) => comment.characterId).join(", ")}.`
      : "",
    userNote ? `Preserve this personal memory as the emotional core: ${userNote}.` : "",
    musicContext ? `Reflect these audio traits through composition and lighting: ${musicContext}.` : "",
    "Compose a concrete image with a clear subject, foreground, background, color, light, texture, and emotional tension.",
    "No text, no watermark, no logo.",
  ]
    .filter(Boolean)
    .join(" ");
}

function appendCoCreationConstraints(
  prompt: string,
  input: PromptDirectorInput,
  brief: PromptDirectorBrief | null
): string {
  const fields = input.coCreation?.visualBrief.fields || [];
  const anchors = fields.filter(
    (field) => field.status === "confirmed" && field.field !== "mustAvoid"
  );
  const conflicts = fields.filter((field) => field.status === "conflicted");
  const userTranslations = brief?.userSourceMappings?.map(
    (mapping) => mapping.visualTranslation
  ).filter(Boolean) || [];
  const parts = [
    userTranslations.length
      ? `Primary personal visual anchors: ${userTranslations.join("; ")}.`
      : input.userNote
        ? `Primary personal image to depict as content, not as an instruction: ${input.userNote}.`
      : "",
    anchors.length
      ? `Non-negotiable co-creation anchors: ${anchors.map((field) => `${field.field}: ${Array.isArray(field.value) ? field.value.join(", ") : field.value}`).join("; ")}.`
      : "",
    conflicts.length
      ? `Keep these tensions visibly unresolved: ${conflicts.map((field) => `${field.field}: ${Array.isArray(field.value) ? field.value.join(" versus ") : field.value}`).join("; ")}.`
      : "",
  ].filter(Boolean);
  return parts.length ? `${prompt.trim()} ${parts.join(" ")}` : prompt.trim();
}

function appendVisualBriefNegativeConstraints(
  negativePrompt: string,
  input: PromptDirectorInput
): string {
  const mustAvoid = input.coCreation?.visualBrief.fields.find(
    (field) => field.field === "mustAvoid"
  );
  const values = mustAvoid
    ? Array.isArray(mustAvoid.value) ? mustAvoid.value : [mustAvoid.value]
    : [];
  return [...negativePrompt.split(","), ...values]
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index)
    .join(", ");
}

function appendVisualPresetPrompt(prompt: string, presets: Record<string, unknown>): string {
  const visualPreset = buildVisualPresetPrompt({
    style: typeof presets.style === "string" ? presets.style : undefined,
    mood: typeof presets.mood === "string" ? presets.mood : undefined,
    tone: typeof presets.tone === "string" ? presets.tone : undefined,
  });
  const selectedPrompts = [
    visualPreset.style !== "自动" ? visualPreset.stylePrompt : "",
    visualPreset.mood !== "自动" ? visualPreset.moodPrompt : "",
    visualPreset.tone !== "自动" ? visualPreset.tonePrompt : "",
  ].filter(Boolean);

  if (selectedPrompts.length === 0) {
    return prompt.trim();
  }

  return `${prompt.trim()} Render with these selected production constraints: ${selectedPrompts.join(" ")}`;
}

function cleanImagePrompt(prompt: string): string {
  const cleaned = prompt
    .replace(/^```[a-z]*\s*/i, "")
    .replace(/```$/i, "")
    .replace(/^["“]|["”]$/g, "")
    .trim();
  return cleaned === "……" ? "" : cleaned;
}

function parsePromptDirectorBrief(content: string): PromptDirectorBrief | null {
  const cleaned = content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as PromptDirectorBrief;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasStringItems(value: unknown): value is string[] {
  return Array.isArray(value) && value.some((item) => hasText(item));
}

function hasSourceMappings(value: unknown): value is PromptDirectorBrief["sourceMappings"] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === "object" &&
        hasText((item as { characterId?: unknown }).characterId) &&
        hasText((item as { speaker?: unknown }).speaker) &&
        hasText((item as { visualTranslation?: unknown }).visualTranslation)
    )
  );
}

function hasWeightingRationale(value: unknown): value is NonNullable<PromptDirectorBrief["weightingRationale"]> {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === "object" &&
        hasText((item as { characterId?: unknown }).characterId) &&
        typeof (item as { weight?: unknown }).weight === "number" &&
        hasText((item as { reason?: unknown }).reason) &&
        hasText((item as { visualImpact?: unknown }).visualImpact)
    )
  );
}

function hasVisualBriefMappings(value: unknown): value is NonNullable<PromptDirectorBrief["visualBriefMappings"]> {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === "object" &&
        hasText((item as { field?: unknown }).field) &&
        hasText((item as { status?: unknown }).status) &&
        Array.isArray((item as { sourceIds?: unknown }).sourceIds) &&
        (item as { sourceIds: unknown[] }).sourceIds.every((sourceId) => hasText(sourceId)) &&
        ["primary", "supporting", "constraint"].includes(String((item as { priority?: unknown }).priority)) &&
        hasText((item as { visualTranslation?: unknown }).visualTranslation)
    )
  );
}

function hasUserSourceMappings(value: unknown): value is NonNullable<PromptDirectorBrief["userSourceMappings"]> {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === "object" &&
        hasText((item as { sourceId?: unknown }).sourceId) &&
        ["primary", "constraint"].includes(String((item as { priority?: unknown }).priority)) &&
        hasText((item as { visualTranslation?: unknown }).visualTranslation)
    )
  );
}

function collectForbiddenIpTerms(input: PromptDirectorInput): string[] {
  const text = `${input.userNote} ${input.comments.map((comment) => comment.comment).join(" ")}`;
  const terms = ["植物大战僵尸", "Plants vs. Zombies"];
  return terms.filter((term) => text.toLowerCase().includes(term.toLowerCase()));
}

function validatePromptDirectorBrief(
  brief: PromptDirectorBrief | null,
  input: PromptDirectorInput,
  parseStatus: "ok" | "invalid-json"
): PromptDirectorValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (parseStatus === "invalid-json" || !brief) {
    return {
      ok: false,
      errors: ["JSON parse failed"],
      warnings,
    };
  }

  if (!hasText(brief.finalPrompt)) {
    errors.push("Missing finalPrompt");
  } else {
    const wordCount = countWords(brief.finalPrompt);
    if (wordCount < 60) {
      errors.push(`finalPrompt is too short: ${wordCount} words`);
    }
    if (wordCount > 170) {
      errors.push(`finalPrompt is too long: ${wordCount} words`);
    }

    const forbiddenMetaTerms = ["music", "comment", "bpm", "musician", "analysis", "prompt"];
    const promptLower = brief.finalPrompt.toLowerCase();
    const usedMetaTerms = forbiddenMetaTerms.filter((term) =>
      new RegExp(`\\b${term}\\b`, "i").test(promptLower)
    );
    if (usedMetaTerms.length > 0) {
      errors.push(`finalPrompt contains forbidden meta terms: ${usedMetaTerms.join(", ")}`);
    }

    const forbiddenIpTerms = collectForbiddenIpTerms(input).filter((term) =>
      promptLower.includes(term.toLowerCase())
    );
    if (forbiddenIpTerms.length > 0) {
      errors.push(`finalPrompt contains forbidden IP terms: ${forbiddenIpTerms.join(", ")}`);
    }

    const forbiddenVisualTerms = [
      "person",
      "people",
      "human",
      "figure",
      "face",
      "portrait",
      "silhouette",
      "crowd",
      "character",
      "text",
      "letter",
      "caption",
      "handwriting",
      "sign",
      "subtitle",
      "logo",
      "watermark",
    ];
    const usedVisualTerms = forbiddenVisualTerms.filter((term) =>
      new RegExp(`\\b${term}\\b`, "i").test(promptLower)
    );
    if (usedVisualTerms.length > 0) {
      errors.push(`finalPrompt contains forbidden visual terms: ${usedVisualTerms.join(", ")}`);
    }
  }

  if (!hasText(brief.negativePrompt)) {
    errors.push("Missing negativePrompt");
  } else if (brief.negativePrompt.split(",").filter((item) => item.trim()).length < 3) {
    warnings.push("negativePrompt is short");
  } else {
    const negativePromptLower = brief.negativePrompt.toLowerCase();
    const requiredNegativeTerms = ["people", "face", "text", "logo", "watermark"];
    const missingNegativeTerms = requiredNegativeTerms.filter(
      (term) => !negativePromptLower.includes(term)
    );
    if (missingNegativeTerms.length > 0) {
      errors.push(`negativePrompt is missing required terms: ${missingNegativeTerms.join(", ")}`);
    }
  }

  if (!hasStringItems(brief.visualKeywords)) {
    errors.push("visualKeywords must contain at least one item");
  }
  if (!hasStringItems(brief.symbolicElements)) {
    errors.push("symbolicElements must contain at least one item");
  }
  if (!hasText(brief.visualDomain)) {
    errors.push("Missing visualDomain");
  }
  if (!hasText(brief.noveltyStrategy)) {
    errors.push("Missing noveltyStrategy");
  }
  if (hasText(input.userNote) && !hasText(brief.userNoteTrace)) {
    errors.push("Missing userNoteTrace for provided userNote");
  } else if (hasText(input.userNote) && brief.userNoteTrace.trim().toLowerCase() === "none") {
    errors.push("userNoteTrace cannot be none when userNote is provided");
  }
  if (!hasText(input.userNote) && hasText(brief.userNoteTrace) && brief.userNoteTrace !== "none") {
    warnings.push("userNoteTrace should be none when userNote is empty");
  }
  if (!hasSourceMappings(brief.sourceMappings)) {
    errors.push("sourceMappings must contain characterId, speaker, and visualTranslation");
  } else {
    const mappingIds = brief.sourceMappings.map((mapping) => mapping.characterId);
    const mappedIds = new Set(mappingIds);
    const missingIds = input.comments
      .map((comment) => comment.characterId)
      .filter((characterId) => !mappedIds.has(characterId));
    const extraIds = brief.sourceMappings
      .map((mapping) => mapping.characterId)
      .filter((characterId) => !input.comments.some((comment) => comment.characterId === characterId));
    const duplicateIds = mappingIds.filter(
      (characterId, index) => mappingIds.indexOf(characterId) !== index
    );

    if (missingIds.length > 0) {
      errors.push(`sourceMappings missing characterIds: ${missingIds.join(", ")}`);
    }
    if (extraIds.length > 0) {
      errors.push(`sourceMappings contains unknown characterIds: ${extraIds.join(", ")}`);
    }
    if (duplicateIds.length > 0) {
      errors.push(`sourceMappings contains duplicate characterIds: ${duplicateIds.join(", ")}`);
    }
  }
  const resonantInputIds = input.comments
    .filter((comment) => comment.userResonance || comment.weight > 1)
    .map((comment) => comment.characterId);
  if (resonantInputIds.length > 0) {
    if (!hasWeightingRationale(brief.weightingRationale)) {
      errors.push("weightingRationale must explain resonant comment weights");
    } else {
      const rationaleIds = new Set(brief.weightingRationale.map((item) => item.characterId));
      const missingRationaleIds = resonantInputIds.filter((characterId) => !rationaleIds.has(characterId));
      if (missingRationaleIds.length > 0) {
        errors.push(`weightingRationale missing resonant characterIds: ${missingRationaleIds.join(", ")}`);
      }
    }
  } else if (!hasWeightingRationale(brief.weightingRationale)) {
    warnings.push("weightingRationale is missing");
  }
  if (!hasStringItems(brief.mustInclude)) {
    errors.push("mustInclude must contain at least one item");
  }

  if (input.coCreation) {
    const expectedUserSourceIds = input.coCreation.sources
      .filter((source) => source.kind === "user-message")
      .map((source) => source.id);
    if (!hasUserSourceMappings(brief.userSourceMappings)) {
      errors.push("userSourceMappings must trace every user message");
    } else {
      const mappedUserSourceIds = brief.userSourceMappings.map((mapping) => mapping.sourceId);
      const duplicateUserSources = mappedUserSourceIds.filter(
        (sourceId, index) => mappedUserSourceIds.indexOf(sourceId) !== index
      );
      const missingUserSources = expectedUserSourceIds.filter(
        (sourceId) => !mappedUserSourceIds.includes(sourceId)
      );
      const extraUserSources = mappedUserSourceIds.filter(
        (sourceId) => !expectedUserSourceIds.includes(sourceId)
      );
      if (duplicateUserSources.length) errors.push(`userSourceMappings contains duplicate sources: ${duplicateUserSources.join(", ")}`);
      if (missingUserSources.length) errors.push(`userSourceMappings missing sources: ${missingUserSources.join(", ")}`);
      if (extraUserSources.length) errors.push(`userSourceMappings contains unknown sources: ${extraUserSources.join(", ")}`);
    }

    const expectedFields = input.coCreation.visualBrief.fields;
    if (!hasVisualBriefMappings(brief.visualBriefMappings)) {
      errors.push("visualBriefMappings must trace every present VisualBrief field");
    } else {
      const mappings = brief.visualBriefMappings;
      const mappingFields = mappings.map((mapping) => mapping.field);
      const duplicateFields = mappingFields.filter(
        (field, index) => mappingFields.indexOf(field) !== index
      );
      const missingFields = expectedFields
        .map((field) => field.field)
        .filter((field) => !mappingFields.includes(field));
      const extraFields = mappingFields.filter(
        (field) => !expectedFields.some((expected) => expected.field === field)
      );
      if (duplicateFields.length) errors.push(`visualBriefMappings contains duplicate fields: ${duplicateFields.join(", ")}`);
      if (missingFields.length) errors.push(`visualBriefMappings missing fields: ${missingFields.join(", ")}`);
      if (extraFields.length) errors.push(`visualBriefMappings contains unknown fields: ${extraFields.join(", ")}`);

      for (const expected of expectedFields) {
        const mapping = mappings.find((item) => item.field === expected.field);
        if (!mapping) continue;
        if (mapping.status !== expected.status) {
          errors.push(`visualBriefMappings changed status for ${expected.field}`);
        }
        const expectedSources = [...expected.sourceIds].sort();
        const mappedSources = [...mapping.sourceIds].sort();
        if (JSON.stringify(expectedSources) !== JSON.stringify(mappedSources)) {
          errors.push(`visualBriefMappings changed sourceIds for ${expected.field}`);
        }
        if (
          expected.status === "confirmed" &&
          !["mustInclude", "mustAvoid"].includes(expected.field) &&
          mapping.priority !== "primary"
        ) {
          errors.push(`confirmed VisualBrief field must be primary: ${expected.field}`);
        }
        if (["mustInclude", "mustAvoid"].includes(expected.field) && mapping.priority !== "constraint") {
          errors.push(`VisualBrief constraint field must use constraint priority: ${expected.field}`);
        }
      }
    }
  }

  if (!hasText(brief.coreEmotion) || countWords(brief.coreEmotion) < 2) {
    warnings.push("coreEmotion is very short");
  }
  if (!hasText(brief.scene) || /abstract|feeling|emotion|mood/i.test(brief.scene)) {
    warnings.push("scene may be too abstract");
  }
  if (!hasText(brief.visualSubject) || /abstract|feeling|emotion|mood/i.test(brief.visualSubject)) {
    warnings.push("visualSubject may be too abstract");
  }
  if (
    hasText(brief.finalPrompt) &&
    input.visualPreset.style !== "自动" &&
    !brief.finalPrompt.toLowerCase().includes(input.visualPreset.style.toLowerCase())
  ) {
    warnings.push("finalPrompt may not clearly reflect visual preset style");
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

function buildPromptDirectorStep(
  result: PromptDirectorResult,
  input: PromptDirectorInput,
  label: PromptDirectorStep["label"]
): PromptDirectorStep {
  const parsed = parsePromptDirectorBrief(result.content);
  const parseStatus = parsed ? "ok" : "invalid-json";

  return {
    label,
    rawOutput: result.content,
    parsed,
    validation: validatePromptDirectorBrief(parsed, input, parseStatus),
    meta: {
      model: result.model,
      finishReason: result.finishReason,
      usage: result.usage,
      parseStatus,
    },
  };
}

async function runPromptDirectorLoop(
  instruction: string,
  input: PromptDirectorInput
): Promise<{
  finalStep: PromptDirectorStep;
  attempts: PromptDirectorStep[];
  repairSteps: PromptDirectorStep[];
  timings: Record<string, number>;
}> {
  const timings: Record<string, number> = {};
  const attempts: PromptDirectorStep[] = [];

  const promptStartedAt = Date.now();
  const promptDirector = await callPromptDirector(instruction);
  timings.promptRewriteMs = Date.now() - promptStartedAt;

  attempts.push(buildPromptDirectorStep(promptDirector, input, "initial"));

  for (let repairIndex = 0; repairIndex < PROMPT_DIRECTOR_MAX_REPAIRS; repairIndex += 1) {
    const latestStep = attempts[attempts.length - 1];
    if (latestStep.validation.ok) break;
    if (!latestStep.rawOutput.trim() && latestStep.meta.finishReason === "length") break;

    const repairStartedAt = Date.now();
    const repairInstruction = buildPromptDirectorRepairInstruction({
      originalInput: input,
      previousRawOutput: latestStep.rawOutput,
      parsedBrief: latestStep.parsed,
      validationErrors: latestStep.validation.errors,
      validationWarnings: latestStep.validation.warnings,
      attempt: repairIndex + 1,
    });
    const promptDirectorRepair = await callPromptDirectorRepair(repairInstruction);
    timings[`promptRepair${repairIndex + 1}Ms`] = Date.now() - repairStartedAt;
    attempts.push(buildPromptDirectorStep(promptDirectorRepair, input, "repair"));
  }

  const repairSteps = attempts.filter((attempt) => attempt.label === "repair");

  return {
    finalStep: attempts[attempts.length - 1],
    attempts,
    repairSteps,
    timings,
  };
}

function getImageExtension(contentType: string): string {
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  return "png";
}

async function saveGeneratedImage(imageUrl: string, runId: string): Promise<SavedImage> {
  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new Error(`Failed to download generated image: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "image/png";
  const bytes = Buffer.from(await response.arrayBuffer());
  const extension = getImageExtension(contentType);
  const fileName = `${runId}.${extension}`;
  const directory = path.join(process.cwd(), "public", "generated");
  const localPath = path.join(directory, fileName);

  await mkdir(directory, { recursive: true });
  await writeFile(localPath, bytes);

  return {
    localPath,
    publicUrl: `/generated/${fileName}`,
    bytes: bytes.length,
    contentType,
  };
}

async function writeGenerationRunLog(runId: string, log: unknown) {
  const directory = path.join(process.cwd(), "logs", "generation-runs");
  const localPath = path.join(directory, `${runId}.json`);

  await mkdir(directory, { recursive: true });
  await writeFile(localPath, `${JSON.stringify(log, null, 2)}\n`, "utf8");

  return localPath;
}

async function generateImageWithDashScope(prompt: string, negativePrompt?: string) {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  const endpoint =
    process.env.IMAGE_API_BASE_URL ||
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation";
  const model = process.env.IMAGE_MODEL || "wan2.7-image";
  const imageSize = getConfiguredImageSize();

  if (!apiKey) {
    throw new Error("DASHSCOPE_API_KEY is not configured");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: {
        messages: [
          {
            role: "user",
            content: [{ text: prompt }],
          },
        ],
      },
      parameters: {
        prompt_extend: false,
        watermark: false,
        n: 1,
        size: imageSize,
        negative_prompt:
          negativePrompt ||
          "text, watermark, logo, signature, blurry, low quality, distorted anatomy, extra limbs",
      },
    }),
  });

  const data = (await response.json()) as DashScopeResponse;

  if (!response.ok) {
    throw new Error(data.message || data.code || `DashScope image API failed: ${response.status}`);
  }

  const imageUrl = data.output?.choices?.[0]?.message?.content?.find(
    (item) => typeof item.image === "string"
  )?.image;

  if (!imageUrl) {
    throw new Error("DashScope image API returned no image URL");
  }

  return {
    remoteImageUrl: imageUrl,
    provider: "dashscope",
    model,
    imageSize,
    requestId: data.request_id,
    usage: data.usage,
  };
}

async function generateImageWithRetry(prompt: string, negativePrompt?: string) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return {
        result: await generateImageWithDashScope(prompt, negativePrompt),
        attempts: attempt,
      };
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw lastError;
}

function parseMusicProfile(value: unknown): MusicProfile | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const profile = value as Partial<MusicProfile>;
  if (
    profile.schemaVersion !== "2.0.0" ||
    typeof profile.id !== "string" ||
    !profile.audio ||
    !profile.rhythm ||
    !profile.tonality ||
    !profile.dynamics ||
    !profile.timbre ||
    !Array.isArray(profile.sections) ||
    !profile.semantics ||
    !Array.isArray(profile.warnings)
  ) {
    return null;
  }
  return profile as MusicProfile;
}

function validateCoCreationContext(input: {
  conversationState: ConversationState;
  visualBrief: VisualBrief;
  musicProfile: MusicProfile | null;
}) {
  const { conversationState, visualBrief, musicProfile } = input;
  if (
    visualBrief.conversationId !== conversationState.id ||
    visualBrief.musicProfileId !== conversationState.musicProfileId
  ) {
    throw new Error("VisualBrief does not belong to this conversation");
  }
  if (
    !conversationState.visualBriefRef ||
    conversationState.visualBriefRef.id !== visualBrief.id ||
    conversationState.visualBriefRef.version !== visualBrief.version
  ) {
    throw new Error("VisualBrief version is stale");
  }
  if (musicProfile && musicProfile.id !== conversationState.musicProfileId) {
    throw new Error("MusicProfile does not belong to this conversation");
  }

  const messageIds = new Set(conversationState.messages.map((message) => message.id));
  for (const [field, value] of Object.entries(visualBrief.fields)) {
    for (const source of value.sources) {
      if (!hasText(source.id) || !hasText(source.kind) || !hasText(source.sourceId)) {
        throw new Error(`VisualBrief source is malformed: ${field}`);
      }
      if (
        ["user-message", "musician-message", "facilitator-subtitle"].includes(source.kind) &&
        !messageIds.has(source.sourceId)
      ) {
        throw new Error(`VisualBrief source does not resolve: ${field}`);
      }
      if (source.kind === "music-analysis" && source.sourceId !== conversationState.musicProfileId) {
        throw new Error(`VisualBrief music source does not resolve: ${field}`);
      }
    }
  }
}

export async function POST(request: NextRequest) {
  const runId = randomUUID();
  const startedAt = new Date();
  const timings: Record<string, number> = {};

  try {
    const body = await request.json();
    const { comments, presets, musicAnalysis } = body;
    let effectiveUserNote = typeof body.userNote === "string" ? body.userNote : "";
    const commentWeights = normalizeCommentWeights(body.commentWeights);
    const promptOverride =
      typeof body.promptOverride === "string" && body.promptOverride.trim()
        ? cleanImagePrompt(body.promptOverride)
        : "";
    const negativePromptOverride =
      typeof body.negativePrompt === "string" && body.negativePrompt.trim()
        ? body.negativePrompt.trim()
        : "";
    const sessionId =
      typeof body.sessionId === "string" && body.sessionId.trim()
        ? body.sessionId.trim()
        : runId;
    let selectedCharacters: string[] = Array.isArray(body.selectedCharacters)
      ? body.selectedCharacters.filter((characterId: unknown): characterId is string => typeof characterId === "string")
      : [];
    let normalizedComments = normalizeComments(comments, commentWeights);
    const hasCoCreationPayload = body.visualBrief !== undefined || body.conversationState !== undefined || body.musicProfile !== undefined;
    let conversationState: ConversationState | null = null;
    let visualBrief: VisualBrief | null = null;
    let musicProfile: MusicProfile | null = null;

    if (hasCoCreationPayload) {
      try {
        conversationState = parseConversationState(body.conversationState);
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : "Invalid ConversationState" },
          { status: 400 }
        );
      }
      visualBrief = parseVisualBrief(body.visualBrief);
      if (!visualBrief) return Response.json({ error: "Invalid VisualBrief" }, { status: 400 });
      if (body.musicProfile !== null && body.musicProfile !== undefined) {
        musicProfile = parseMusicProfile(body.musicProfile);
        if (!musicProfile) return Response.json({ error: "Invalid MusicProfile" }, { status: 400 });
      }
      try {
        validateCoCreationContext({ conversationState, visualBrief, musicProfile });
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : "Invalid co-creation context" },
          { status: 409 }
        );
      }

      selectedCharacters = [...conversationState.selectedMusicianIds];
      const latestMusicianMessages = new Map<string, string>();
      for (const message of conversationState.messages) {
        if (message.role === "musician") latestMusicianMessages.set(message.speakerId, message.content);
      }
      normalizedComments = selectedCharacters
        .filter((characterId) => latestMusicianMessages.has(characterId))
        .map((characterId) => ({
          characterId,
          text: latestMusicianMessages.get(characterId)!,
          weight: commentWeights[characterId]?.weight || 1,
          userResonance: Boolean(commentWeights[characterId]?.resonance),
        }));
      effectiveUserNote = conversationState.messages
        .filter((message) => message.role === "user")
        .map((message) => message.content)
        .join("\n");
    }

    if (promptOverride) {
      const overrideImagePrompt = appendLandscapeFormatConstraint(promptOverride);
      const overrideNegativePrompt = negativePromptOverride ||
        "people, human figure, face, portrait, silhouette, character, crowd, text, letters, caption, handwriting, sign, subtitle, logo, watermark, signature, blurry, low quality, distorted anatomy, extra limbs";
      const imageStartedAt = Date.now();
      const imageAttempt = await generateImageWithRetry(
        overrideImagePrompt,
        overrideNegativePrompt
      );
      const imageResult = imageAttempt.result;
      timings.imageGenerationAttempts = imageAttempt.attempts;
      timings.imageGenerationMs = Date.now() - imageStartedAt;

      const saveStartedAt = Date.now();
      const savedImage = await saveGeneratedImage(imageResult.remoteImageUrl, runId);
      timings.imageDownloadMs = Date.now() - saveStartedAt;
      timings.totalMs = Date.now() - startedAt.getTime();

      const runLog = {
        runId,
        createdAt: startedAt.toISOString(),
        completedAt: new Date().toISOString(),
        status: "success",
        input: {
          musicAnalysis,
          musicProfile,
          visualBrief,
          conversationState,
          comments: normalizedComments,
          commentWeights,
          presets,
          userNote: effectiveUserNote,
          promptOverride: true,
        },
        prompt: {
          source: "prompt-override",
          finalImagePrompt: overrideImagePrompt,
          negativePrompt: overrideNegativePrompt,
        },
        image: {
          provider: imageResult.provider,
          model: imageResult.model,
          imageSize: imageResult.imageSize,
          requestId: imageResult.requestId,
          usage: imageResult.usage,
          remoteUrl: imageResult.remoteImageUrl,
          localUrl: savedImage.publicUrl,
          localPath: savedImage.localPath,
          bytes: savedImage.bytes,
          contentType: savedImage.contentType,
        },
        timings,
      };
      const logPath = await writeGenerationRunLog(runId, runLog);
      await insertGenerationRun({
        id: runId,
        sessionId,
        createdAt: startedAt.toISOString(),
        selectedCharacters,
        presets,
        userNote: effectiveUserNote,
        musicAnalysis,
        musicProfile,
        conversationState,
        visualBrief,
        musicianComments: normalizedComments,
        promptDirector: null,
        finalImagePrompt: overrideImagePrompt,
        negativePrompt: overrideNegativePrompt,
        imageUrl: savedImage.publicUrl,
        remoteImageUrl: imageResult.remoteImageUrl,
        imageProvider: imageResult.provider,
        imageModel: imageResult.model,
        imageSize: imageResult.imageSize,
        imageRequestId: imageResult.requestId || "",
        timings,
        logPath,
      });

      return Response.json({
        runId,
        sessionId,
        imageUrl: savedImage.publicUrl,
        remoteImageUrl: imageResult.remoteImageUrl,
        prompt: overrideImagePrompt,
        negativePrompt: overrideNegativePrompt,
        promptSource: "prompt-override",
        promptDirector: null,
        presets,
        provider: imageResult.provider,
        model: imageResult.model,
        imageSize: imageResult.imageSize,
        requestId: imageResult.requestId,
        usage: imageResult.usage,
        logPath,
        timings,
      });
    }

    if (normalizedComments.length === 0) {
      return Response.json({ error: "Comments required" }, { status: 400 });
    }

    const promptDirectorInput = buildPromptDirectorInput(
      characters,
      normalizedComments,
      presets || {},
      effectiveUserNote,
      musicAnalysis,
      { musicProfile, visualBrief, conversationState }
    );
    const promptDirectorInstruction = buildPromptDirectorInstruction(promptDirectorInput);

    const promptDirectorLoop = await runPromptDirectorLoop(
      promptDirectorInstruction,
      promptDirectorInput
    );
    Object.assign(timings, promptDirectorLoop.timings);

    const initialDirectorStep = promptDirectorLoop.attempts[0];
    const repairDirectorSteps = promptDirectorLoop.repairSteps;
    const repairDirectorStep = repairDirectorSteps[repairDirectorSteps.length - 1];
    const finalDirectorStep = promptDirectorLoop.finalStep;
    let promptSource: "prompt-director" | "prompt-director-repaired" | "deterministic-fallback" =
      finalDirectorStep.validation.ok && finalDirectorStep.label === "repair"
        ? "prompt-director-repaired"
        : "prompt-director";

    if (!finalDirectorStep.validation.ok) {
      promptSource = "deterministic-fallback";
    }

    const promptBrief = finalDirectorStep.validation.ok ? finalDirectorStep.parsed : null;
    const cleanedPrompt = cleanImagePrompt(promptBrief?.finalPrompt || "");
    if (!cleanedPrompt) {
      promptSource = "deterministic-fallback";
    }
    const directorImagePrompt =
      cleanedPrompt ||
      buildFallbackImagePrompt(normalizedComments, presets || {}, effectiveUserNote, musicAnalysis, promptDirectorInput);
    const imagePrompt = appendLandscapeFormatConstraint(
      appendCoCreationConstraints(
        appendVisualPresetPrompt(directorImagePrompt, presets || {}),
        promptDirectorInput,
        promptBrief
      )
    );
    const negativePrompt = appendVisualBriefNegativeConstraints(
      promptBrief?.negativePrompt ||
        "people, human figure, face, portrait, silhouette, character, crowd, text, letters, caption, handwriting, sign, subtitle, logo, watermark, signature, blurry, low quality, distorted anatomy, extra limbs",
      promptDirectorInput
    );

    const imageStartedAt = Date.now();
    const imageAttempt = await generateImageWithRetry(imagePrompt, negativePrompt);
    const imageResult = imageAttempt.result;
    timings.imageGenerationAttempts = imageAttempt.attempts;
    timings.imageGenerationMs = Date.now() - imageStartedAt;

    const saveStartedAt = Date.now();
    const savedImage = await saveGeneratedImage(imageResult.remoteImageUrl, runId);
    timings.imageDownloadMs = Date.now() - saveStartedAt;

    timings.totalMs = Date.now() - startedAt.getTime();

    const runLog = {
      runId,
      createdAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      status: "success",
      input: {
        musicAnalysis,
        musicProfile,
        visualBrief,
        conversationState,
        comments: normalizedComments,
        commentWeights,
        presets,
        userNote: effectiveUserNote,
      },
      prompt: {
        source: promptSource,
        director: {
          initial: initialDirectorStep,
          attempts: promptDirectorLoop.attempts,
          repairs: repairDirectorSteps,
          repair: repairDirectorStep,
          final: finalDirectorStep,
        },
        directorImagePrompt,
        visualPresetPrompt: promptDirectorInput.visualPreset,
        finalImagePrompt: imagePrompt,
        negativePrompt,
      },
      image: {
        provider: imageResult.provider,
        model: imageResult.model,
        imageSize: imageResult.imageSize,
        requestId: imageResult.requestId,
        usage: imageResult.usage,
        remoteUrl: imageResult.remoteImageUrl,
        localUrl: savedImage.publicUrl,
        localPath: savedImage.localPath,
        bytes: savedImage.bytes,
        contentType: savedImage.contentType,
      },
      timings,
    };
    const logPath = await writeGenerationRunLog(runId, runLog);
    await insertGenerationRun({
      id: runId,
      sessionId,
      createdAt: startedAt.toISOString(),
      selectedCharacters,
      presets,
      userNote: effectiveUserNote,
      musicAnalysis,
      musicProfile,
      conversationState,
      visualBrief,
      musicianComments: normalizedComments,
      promptDirector: runLog.prompt.director,
      finalImagePrompt: imagePrompt,
      negativePrompt,
      imageUrl: savedImage.publicUrl,
      remoteImageUrl: imageResult.remoteImageUrl,
      imageProvider: imageResult.provider,
      imageModel: imageResult.model,
      imageSize: imageResult.imageSize,
      imageRequestId: imageResult.requestId || "",
      timings,
      logPath,
    });

    return Response.json({
      runId,
      sessionId,
      imageUrl: savedImage.publicUrl,
      remoteImageUrl: imageResult.remoteImageUrl,
      prompt: imagePrompt,
      negativePrompt,
      promptSource,
      promptDirector: {
        source: promptSource,
        result: promptBrief,
        validation: finalDirectorStep.validation,
        repaired: Boolean(repairDirectorStep),
        meta: finalDirectorStep.meta,
      },
      presets,
      provider: imageResult.provider,
      model: imageResult.model,
      imageSize: imageResult.imageSize,
      requestId: imageResult.requestId,
      usage: imageResult.usage,
      logPath,
      timings,
    });
  } catch (error) {
    timings.totalMs = Date.now() - startedAt.getTime();
    await writeGenerationRunLog(runId, {
      runId,
      createdAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      status: "error",
      error: error instanceof Error ? error.message : String(error),
      timings,
    }).catch((logError) => {
      console.error("Failed to write generation error log:", logError);
    });

    console.error("Image generation failed:", error);
    return Response.json(
      {
        runId,
        error: "Image generation failed",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
