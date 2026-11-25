import { randomUUID } from "node:crypto";
import { isAudioLabRequestAllowed } from "@/lib/audio-lab/access";
import {
  prepareAudioLabImage,
  resolveAudioLabImageAsset,
} from "@/lib/audio-lab/image-assets";
import { insertAudioLabAsset, type AudioLabAssetRecord } from "@/lib/db/audio-lab-assets";
import {
  buildSeedAudioRequest,
  normalizeSeedAudioPrompt,
  SEED_AUDIO_ENDPOINT,
  SEED_AUDIO_MODEL,
} from "@/lib/seed-audio";
import { materializeSeedAudio, persistAudioLabFile } from "@/lib/storage/audio-lab";
import {
  createVisualMusicBrief,
  type VisualMusicMode,
} from "@/lib/visual-music-brief";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

interface SeedAudioProviderResponse {
  code?: number;
  message?: string;
  audio?: string;
  duration?: number;
  original_duration?: number;
  url?: string;
}

function apiKey(): string {
  const value = process.env.SEED_AUDIO_API_KEY?.trim();
  if (!value) {
    throw new Error("服务端尚未配置 SEED_AUDIO_API_KEY");
  }
  return value;
}

export async function GET(request: Request) {
  if (!isAudioLabRequestAllowed(request)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({
    configured: Boolean(
      process.env.SEED_AUDIO_API_KEY?.trim() && process.env.DASHSCOPE_API_KEY?.trim()
    ),
    model: SEED_AUDIO_MODEL,
  });
}

function parseMode(value: unknown): VisualMusicMode {
  return value === "interpretive" || value === "soundscape" ? value : "instrumental";
}

export async function POST(request: Request) {
  const requestId = randomUUID();

  try {
    if (!isAudioLabRequestAllowed(request)) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    const body = await request.json() as {
      sourceImageId?: unknown;
      prompt?: unknown;
      mode?: unknown;
    };
    const direction = normalizeSeedAudioPrompt(body.prompt);
    if (typeof body.sourceImageId !== "string" || !body.sourceImageId.trim()) {
      throw new Error("请先从实验图片库选择一幅作品");
    }
    const mode = parseMode(body.mode);
    const sourceImage = await resolveAudioLabImageAsset(body.sourceImageId.trim());
    const image = await prepareAudioLabImage(sourceImage);
    const visualBrief = await createVisualMusicBrief({
      imageDataUrl: image.imageDataUrl,
      direction,
      mode,
      signal: AbortSignal.timeout(90_000),
    });

    const response = await fetch(SEED_AUDIO_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey(),
        "X-Api-Request-Id": requestId,
      },
      // Text-only mode avoids Seed Audio's image-reference branch, which may
      // interpret the artwork as a request for spoken visual narration.
      body: JSON.stringify(buildSeedAudioRequest(visualBrief.musicPrompt)),
      signal: AbortSignal.timeout(295_000),
      cache: "no-store",
    });

    const providerLogId = response.headers.get("X-Tt-Logid");
    const rawText = await response.text();
    let providerResult: SeedAudioProviderResponse;
    try {
      providerResult = JSON.parse(rawText) as SeedAudioProviderResponse;
    } catch {
      throw new Error(`音频服务返回了无法解析的响应（HTTP ${response.status}）`);
    }

    if (!response.ok || (providerResult.code != null && providerResult.code !== 0)) {
      const detail = providerResult.message || `HTTP ${response.status}`;
      throw new Error(`豆包音频生成失败：${detail}`);
    }
    if (!providerResult.audio && !providerResult.url) {
      throw new Error("豆包音频生成成功，但响应中没有可播放的音频");
    }

    const materialized = await materializeSeedAudio({
      audioBase64: providerResult.audio,
      audioUrl: providerResult.url,
    });
    const assetId = randomUUID();
    const stored = await persistAudioLabFile(materialized.bytes, assetId, materialized.contentType);
    const createdAt = new Date().toISOString();
    const asset: AudioLabAssetRecord = {
      id: assetId,
      createdAt,
      ...stored,
      duration: providerResult.duration ?? null,
      format: "mp3",
      mode,
      userDirection: direction,
      visualSummary: visualBrief.visualSummary,
      musicPrompt: visualBrief.musicPrompt,
      sourceRunId: sourceImage.id,
      sourceImageUrl: sourceImage.imageUrl,
      sourceThumbnailUrl: sourceImage.thumbnailUrl,
      sourceMusicTitle: sourceImage.musicTitle,
      sourceRole: sourceImage.role,
      sourceOrigins: sourceImage.dataOrigins,
      visualModel: visualBrief.model,
      audioModel: SEED_AUDIO_MODEL,
      providerRequestId: requestId,
      providerLogId: providerLogId || "",
    };
    await insertAudioLabAsset(asset);

    return Response.json({
      asset: {
        ...asset,
        sourceAudio: sourceImage.sourceAudio,
        audioUrl: `/api/audio-lab/assets/${encodeURIComponent(asset.id)}/file`,
        downloadUrl: `/api/audio-lab/assets/${encodeURIComponent(asset.id)}/file?download=1`,
      },
      requestId,
      providerLogId,
      model: SEED_AUDIO_MODEL,
      input: {
        sourceImageId: sourceImage.id,
        imageBytes: image.byteLength,
        promptCharacters: direction.length,
      },
      visualBrief,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "音频生成失败";
    const status = message.includes("尚未配置") ? 503 : 400;
    console.error("Seed Audio generation failed", { requestId, message });
    return Response.json({ error: message, requestId }, { status });
  }
}
