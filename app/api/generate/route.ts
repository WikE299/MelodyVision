import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { synthesizeImagePrompt } from "@/lib/prompts/image-gen";
import { callLLMForImagePrompt } from "@/lib/llm";
import { characters } from "@/lib/characters";

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
  userNote?: string
): string {
  const styleMap: Record<string, string> = {
    水墨: "Chinese ink wash painting",
    油画: "expressive oil painting",
    抽象: "abstract atmospheric painting",
    写实: "realistic cinematic painting",
  };
  const moodMap: Record<string, string> = {
    宁静: "serene and contemplative",
    激昂: "dramatic and powerful",
    忧伤: "melancholic and restrained",
    欢快: "bright and joyful",
  };
  const toneMap: Record<string, string> = {
    暖色: "warm amber and gold",
    冷色: "cool blue and silver",
    淡雅: "muted elegant gray-green",
    浓烈: "rich high-contrast colors",
  };
  const style = styleMap[presets.style || ""] || "poetic painterly";
  const mood = moodMap[presets.mood || ""] || "serene and contemplative";
  const tone = toneMap[presets.tone || ""] || "muted elegant";
  const hasForce = comments.some((comment) => /命运|力|拳|搏|抗|火/.test(comment.text));
  const hasWater = comments.some((comment) => /水|溪|河|流|潭|山/.test(comment.text));
  const hasEcho = comments.some((comment) => /回响|回声|弦外|远/.test(comment.text)) || Boolean(userNote);
  const motifs = [
    hasWater ? "a winding river through layered mountains" : "layered mountains and drifting mist",
    hasEcho ? "distant echoes visualized as faint ripples of light" : "subtle flowing brush strokes",
    hasForce ? "a restrained undercurrent of tension beneath the calm surface" : "quiet emotional depth",
  ].join(", ");

  return `Create a ${style} with a ${mood} atmosphere and a ${tone} color palette. The scene should transform musical impressions into visual motifs: ${motifs}. Use clear composition, layered depth, expressive light, delicate texture, and a poetic sense of space. No text, no watermark, no logo.`;
}

function cleanImagePrompt(prompt: string): string {
  const cleaned = prompt
    .replace(/^```[a-z]*\s*/i, "")
    .replace(/```$/i, "")
    .replace(/^["“]|["”]$/g, "")
    .trim();
  return cleaned === "……" ? "" : cleaned;
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

async function generateImageWithDashScope(prompt: string) {
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
    const normalizedComments = normalizeComments(comments);

    if (normalizedComments.length === 0) {
      return Response.json({ error: "Comments required" }, { status: 400 });
    }

    const imageGenPrompt = synthesizeImagePrompt(
      characters,
      normalizedComments,
      presets || {},
      userNote
    );

    const promptStartedAt = Date.now();
    const rawImagePrompt = await callLLMForImagePrompt(
      imageGenPrompt,
      "Generate the final image prompt now. Output only the English prompt, without explanation or markdown."
    );
    timings.promptRewriteMs = Date.now() - promptStartedAt;

    const cleanedPrompt = cleanImagePrompt(rawImagePrompt);
    const promptSource = cleanedPrompt ? "llm" : "fallback";
    const imagePrompt = cleanedPrompt || buildFallbackImagePrompt(normalizedComments, presets || {}, userNote);

    const imageStartedAt = Date.now();
    const imageResult = await generateImageWithDashScope(imagePrompt);
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
        synthesisInstruction: imageGenPrompt,
        rawImagePrompt,
        finalImagePrompt: imagePrompt,
        source: promptSource,
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

    return Response.json({
      runId,
      imageUrl: savedImage.publicUrl,
      remoteImageUrl: imageResult.remoteImageUrl,
      prompt: imagePrompt,
      promptSource,
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
