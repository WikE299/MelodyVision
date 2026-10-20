import { getDatabase, toJson } from "./index.ts";

export type AudioLabMode = "instrumental" | "interpretive" | "soundscape";
export type AudioLabStorageProvider = "local" | "supabase";

export interface AudioLabAssetRecord {
  id: string;
  createdAt: string;
  storageProvider: AudioLabStorageProvider;
  storagePath: string;
  contentType: string;
  bytes: number;
  duration: number | null;
  format: string;
  mode: AudioLabMode;
  userDirection: string;
  visualSummary: string;
  musicPrompt: string;
  sourceRunId: string;
  sourceImageUrl: string;
  sourceThumbnailUrl: string;
  sourceMusicTitle: string;
  sourceRole: string;
  sourceOrigins: string[];
  visualModel: string;
  audioModel: string;
  providerRequestId: string;
  providerLogId: string;
}

function numberOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  try {
    const parsed = JSON.parse(String(value || "[]")) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function rowToAsset(row: Record<string, unknown>): AudioLabAssetRecord {
  return {
    id: String(row.id || ""),
    createdAt: String(row.created_at || ""),
    storageProvider: row.storage_provider === "supabase" ? "supabase" : "local",
    storagePath: String(row.storage_path || ""),
    contentType: String(row.content_type || "audio/mpeg"),
    bytes: Number(row.bytes || 0),
    duration: row.duration == null ? null : numberOrNull(row.duration),
    format: String(row.format || "mp3"),
    mode: row.mode === "interpretive" || row.mode === "soundscape" ? row.mode : "instrumental",
    userDirection: String(row.user_direction || ""),
    visualSummary: String(row.visual_summary || ""),
    musicPrompt: String(row.music_prompt || ""),
    sourceRunId: String(row.source_run_id || ""),
    sourceImageUrl: String(row.source_image_url || ""),
    sourceThumbnailUrl: String(row.source_thumbnail_url || ""),
    sourceMusicTitle: String(row.source_music_title || ""),
    sourceRole: String(row.source_role || ""),
    sourceOrigins: parseJsonArray(row.source_origins_json),
    visualModel: String(row.visual_model || ""),
    audioModel: String(row.audio_model || ""),
    providerRequestId: String(row.provider_request_id || ""),
    providerLogId: String(row.provider_log_id || ""),
  };
}

export async function insertAudioLabAsset(record: AudioLabAssetRecord): Promise<void> {
  const database = await getDatabase();
  await database.prepare(`
    INSERT INTO audio_lab_assets (
      id, created_at, storage_provider, storage_path, content_type, bytes,
      duration, format, mode, user_direction, visual_summary, music_prompt,
      source_run_id, source_image_url, source_thumbnail_url, source_music_title,
      source_role, source_origins_json, visual_model, audio_model,
      provider_request_id, provider_log_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.id,
    record.createdAt,
    record.storageProvider,
    record.storagePath,
    record.contentType,
    record.bytes,
    record.duration,
    record.format,
    record.mode,
    record.userDirection,
    record.visualSummary,
    record.musicPrompt,
    record.sourceRunId,
    record.sourceImageUrl,
    record.sourceThumbnailUrl,
    record.sourceMusicTitle,
    record.sourceRole,
    toJson(record.sourceOrigins),
    record.visualModel,
    record.audioModel,
    record.providerRequestId,
    record.providerLogId
  );
}

export async function listAudioLabAssets(limit = 100): Promise<AudioLabAssetRecord[]> {
  const database = await getDatabase();
  const safeLimit = Math.max(1, Math.min(250, Math.floor(limit)));
  const rows = await database.prepare(`
    SELECT * FROM audio_lab_assets ORDER BY created_at DESC LIMIT ?
  `).all(safeLimit);
  return rows.map(rowToAsset);
}

export async function getAudioLabAsset(id: string): Promise<AudioLabAssetRecord | null> {
  const database = await getDatabase();
  const row = (await database.prepare(`
    SELECT * FROM audio_lab_assets WHERE id = ? LIMIT 1
  `).all(id))[0];
  return row ? rowToAsset(row) : null;
}
