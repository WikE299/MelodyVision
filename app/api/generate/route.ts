import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
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

export const runtime = "nodejs";

interface CommentInput {
  characterId: string;
  text: string;
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

const PROMPT_DIRECTOR_MAX_REPAIRS = 2;

function normalizeComments(comments: unknown): CommentInput[] {
  if (Array.isArray(comments)) {
    return comments
      .map((comment) => {
        if (
          comment &&
          typeof comment === "object" &&
          "characterId" in comment &&
          "text" in comment
        ) {
          return {
            characterId: String(comment.characterId),
            text: String(comment.text),
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
    }));
  }

  return [];
}

function buildFallbackImagePrompt(
  comments: CommentInput[],
  presets: { style?: string; mood?: string; tone?: string },
  userNote?: string,
  musicAnalysis?: Record<string, unknown>
): string {
  const sourceFragments = comments
    .map((comment) => comment.text.trim())
    .filter(Boolean)
    .join(" / ");
  const musicContext = musicAnalysis
    ? [
        musicAnalysis.description,
        musicAnalysis.tempo,
        musicAnalysis.mood,
        musicAnalysis.energy,
        musicAnalysis.brightness,
      ]
        .filter(Boolean)
        .map(String)
        .join(" / ")
    : "";

  return [
    "Create one distinctive visual concept with a clear focal subject. Do not default to a generic landscape.",
    `Use the following source impressions as mandatory visual anchors: ${sourceFragments}.`,
    userNote ? `Preserve this personal memory as the emotional core: ${userNote}.` : "",
    musicContext ? `Reflect these audio traits through composition and lighting: ${musicContext}.` : "",
    "Compose a concrete image with a clear subject, foreground, background, color, light, texture, and emotional tension.",
    "No text, no watermark, no logo.",
  ]
    .filter(Boolean)
    .join(" ");
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
  if (!hasStringItems(brief.mustInclude)) {
    errors.push("mustInclude must contain at least one item");
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
        size: "1280*1280",
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
    requestId: data.request_id,
    usage: data.usage,
  };
}

export async function POST(request: NextRequest) {
  const runId = randomUUID();
  const startedAt = new Date();
  const timings: Record<string, number> = {};

  try {
    const body = await request.json();
    const { comments, presets, userNote, musicAnalysis } = body;
    const sessionId =
      typeof body.sessionId === "string" && body.sessionId.trim()
        ? body.sessionId.trim()
        : runId;
    const selectedCharacters = Array.isArray(body.selectedCharacters)
      ? body.selectedCharacters.filter((characterId: unknown) => typeof characterId === "string")
      : [];
    const normalizedComments = normalizeComments(comments);

    if (normalizedComments.length === 0) {
      return Response.json({ error: "Comments required" }, { status: 400 });
    }

    const promptDirectorInput = buildPromptDirectorInput(
      characters,
      normalizedComments,
      presets || {},
      userNote,
      musicAnalysis
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
      buildFallbackImagePrompt(normalizedComments, presets || {}, userNote, musicAnalysis);
    const imagePrompt = appendVisualPresetPrompt(directorImagePrompt, presets || {});
    const negativePrompt =
      promptBrief?.negativePrompt ||
      "people, human figure, face, portrait, silhouette, character, crowd, text, letters, caption, handwriting, sign, subtitle, logo, watermark, signature, blurry, low quality, distorted anatomy, extra limbs";

    const imageStartedAt = Date.now();
    const imageResult = await generateImageWithDashScope(imagePrompt, negativePrompt);
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
        comments: normalizedComments,
        presets,
        userNote,
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
      userNote: typeof userNote === "string" ? userNote : "",
      musicAnalysis,
      musicianComments: normalizedComments,
      promptDirector: runLog.prompt.director,
      finalImagePrompt: imagePrompt,
      negativePrompt,
      imageUrl: savedImage.publicUrl,
      remoteImageUrl: imageResult.remoteImageUrl,
      imageProvider: imageResult.provider,
      imageModel: imageResult.model,
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
