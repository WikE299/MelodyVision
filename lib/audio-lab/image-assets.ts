import { access, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { exportExperimentJson } from "../db/export.ts";
import {
  buildResearchDashboardDataset,
  mergeResearchDashboardDatasets,
  type ResearchArtworkRecord,
  type ResearchDashboardDataset,
  type ResearchDataOrigin,
} from "../research-dashboard.ts";
import {
  fetchRemoteResearchExport,
  fetchSupabaseResearchExport,
  getRemoteResearchConfig,
  getRemoteSupabaseResearchConfig,
  readRemoteResearchCache,
} from "../research-remote.ts";
import {
  buildResearchThumbnailUrl,
  isAllowedResearchImageUrl,
} from "../research-thumbnail.ts";

const MAX_SOURCE_BYTES = 20 * 1024 * 1024;

export interface AudioLabImageAsset {
  id: string;
  createdAt: string;
  musicTitle: string;
  role: string;
  imageSize: string;
  imageUrl: string;
  thumbnailUrl: string;
  dataOrigins: ResearchDataOrigin[];
  artworkType: "co_created" | "direct_baseline";
  condition: "single_agent" | "multi_agent" | "unknown";
  sourceAudio: {
    title: string;
    artist: string;
    sourceKind: "preset" | "search" | "upload" | "unknown";
    source: string;
    tags: string[];
    durationSeconds: number | null;
    bpm: number | null;
    key: string;
    mode: string;
    playbackUrl: string;
    browserCacheKey: string;
    availability: "ready" | "browser_cache" | "unavailable";
  };
}

function displayImageUrl(artwork: ResearchArtworkRecord): string {
  if (artwork.dataOrigins.includes("local") && artwork.imageUrl.startsWith("/generated/")) {
    return artwork.imageUrl;
  }
  return artwork.remoteImageUrl || artwork.imageUrl;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function finiteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function selectedAudioForArtwork(
  dataset: ResearchDashboardDataset,
  artwork: ResearchArtworkRecord
): Record<string, unknown> | null {
  const session = dataset.studySessions.find((candidate) => candidate.id === artwork.studySessionId);
  if (!session) return null;
  const firstUsesX = session.sequence.includes("_x_then_");
  const useFirstSelection = artwork.period === 1 ? firstUsesX : !firstUsesX;
  return useFirstSelection ? session.firstSelectedAudio : session.secondSelectedAudio;
}

function sourceAudioForArtwork(
  dataset: ResearchDashboardDataset,
  artwork: ResearchArtworkRecord
): AudioLabImageAsset["sourceAudio"] {
  const profile = record(artwork.musicProfile);
  const profileAudio = record(profile?.audio);
  const rhythm = record(profile?.rhythm);
  const bpm = record(rhythm?.bpm);
  const tonality = record(profile?.tonality);
  const key = record(tonality?.key);
  const mode = record(tonality?.mode);
  const selected = selectedAudioForArtwork(dataset, artwork);
  const rawSourceKind = text(selected?.sourceKind) || text(profileAudio?.sourceKind);
  const sourceKind = rawSourceKind === "preset" || rawSourceKind === "search" || rawSourceKind === "upload"
    ? rawSourceKind
    : "unknown";
  const catalogItemId = text(selected?.catalogItemId) || text(profileAudio?.catalogItemId);
  const cacheKey = sourceKind === "upload" ? text(selected?.id) : "";
  const storedPlayback = text(selected?.playbackUrl);
  const playbackUrl = sourceKind === "preset" && catalogItemId
    ? `/api/audio/preset/${encodeURIComponent(catalogItemId)}`
    : sourceKind === "search" && catalogItemId
      ? `/api/music/download?id=${encodeURIComponent(catalogItemId)}`
      : /^\/api\/(?:audio\/preset|music\/download)/.test(storedPlayback)
        ? storedPlayback
        : "";
  return {
    title: text(selected?.name) || artwork.musicTitle || text(profileAudio?.name) || "未命名音乐",
    artist: text(selected?.artist),
    sourceKind,
    source: text(selected?.source),
    tags: Array.isArray(selected?.tags)
      ? selected.tags.filter((tag): tag is string => typeof tag === "string").slice(0, 8)
      : [],
    durationSeconds: finiteNumber(profileAudio?.durationSeconds),
    bpm: finiteNumber(bpm?.value),
    key: text(key?.value),
    mode: text(mode?.value),
    playbackUrl,
    browserCacheKey: cacheKey,
    availability: playbackUrl ? "ready" : cacheKey ? "browser_cache" : "unavailable",
  };
}

function toImageAsset(
  dataset: ResearchDashboardDataset,
  artwork: ResearchArtworkRecord
): AudioLabImageAsset {
  const imageUrl = displayImageUrl(artwork);
  return {
    id: artwork.id,
    createdAt: artwork.createdAt,
    musicTitle: artwork.musicTitle,
    role: artwork.role,
    imageSize: artwork.imageSize,
    imageUrl,
    thumbnailUrl: buildResearchThumbnailUrl(imageUrl),
    dataOrigins: artwork.dataOrigins,
    artworkType: artwork.role === "direct_baseline" ? "direct_baseline" : "co_created",
    condition: artwork.condition,
    sourceAudio: sourceAudioForArtwork(dataset, artwork),
  };
}

async function remoteDataset(): Promise<ResearchDashboardDataset | null> {
  try {
    const supabase = getRemoteSupabaseResearchConfig();
    const exported = getRemoteResearchConfig();
    const snapshot = supabase
      ? await fetchSupabaseResearchExport(supabase)
      : exported
        ? await fetchRemoteResearchExport(exported)
        : await readRemoteResearchCache();
    if (!snapshot) return null;
    return buildResearchDashboardDataset(snapshot, supabase || exported ? "remote" : "remote-cache");
  } catch (error) {
    console.warn("Audio Lab could not refresh the online image library", error);
    const cached = await readRemoteResearchCache();
    return cached ? buildResearchDashboardDataset(cached, "remote-cache") : null;
  }
}

export async function loadAudioLabImageAssets(): Promise<AudioLabImageAsset[]> {
  const local = buildResearchDashboardDataset(await exportExperimentJson(), "database");
  const remote = await remoteDataset();
  const dataset = remote ? mergeResearchDashboardDatasets([local, remote]) : local;
  const candidates = dataset.artworks.filter((artwork) => !artwork.trashed && Boolean(displayImageUrl(artwork)));
  const resolved = await Promise.all(candidates.map(async (artwork) => {
    const asset = toImageAsset(dataset, artwork);
    if (asset.imageUrl.startsWith("/generated/")) {
      return await localGeneratedFileExists(asset.imageUrl) ? asset : null;
    }
    return isAllowedResearchImageUrl(asset.imageUrl) ? asset : null;
  }));
  return resolved.filter((asset): asset is AudioLabImageAsset => Boolean(asset));
}

export async function resolveAudioLabImageAsset(id: string): Promise<AudioLabImageAsset> {
  const asset = (await loadAudioLabImageAssets()).find((candidate) => candidate.id === id);
  if (!asset) throw new Error("这张实验图片已不存在，请刷新图片库后重试");
  return asset;
}

async function localGeneratedFile(imageUrl: string): Promise<Buffer | null> {
  if (!imageUrl.startsWith("/generated/")) return null;
  const fileName = path.basename(imageUrl.split("?")[0]);
  const target = path.join(/* turbopackIgnore: true */ process.cwd(), "public", "generated", fileName);
  try {
    await access(target);
    return readFile(target);
  } catch {
    return null;
  }
}

async function localGeneratedFileExists(imageUrl: string): Promise<boolean> {
  if (!imageUrl.startsWith("/generated/")) return false;
  const fileName = path.basename(imageUrl.split("?")[0]);
  const target = path.join(/* turbopackIgnore: true */ process.cwd(), "public", "generated", fileName);
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function remoteImageFile(imageUrl: string): Promise<Buffer> {
  if (!isAllowedResearchImageUrl(imageUrl)) {
    throw new Error("图片地址不在研究图片库的可信范围内");
  }
  const response = await fetch(imageUrl, {
    headers: { Accept: "image/*" },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`读取实验图片失败（HTTP ${response.status}）`);
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > MAX_SOURCE_BYTES) throw new Error("实验图片超过 20MB，暂时无法处理");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > MAX_SOURCE_BYTES) throw new Error("实验图片超过 20MB，暂时无法处理");
  return bytes;
}

export async function prepareAudioLabImage(asset: AudioLabImageAsset): Promise<{
  imageDataUrl: string;
  byteLength: number;
}> {
  const local = await localGeneratedFile(asset.imageUrl);
  const source = local || await remoteImageFile(asset.imageUrl);
  const converted = await sharp(source)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .webp({ quality: 88 })
    .toBuffer();
  if (converted.byteLength > 10 * 1024 * 1024) {
    throw new Error("图片处理后仍超过 10MB，请选择另一张作品");
  }
  return {
    imageDataUrl: `data:image/webp;base64,${converted.toString("base64")}`,
    byteLength: converted.byteLength,
  };
}
