import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { usesSupabaseDatabase } from "../db/index.ts";
import type { AudioLabStorageProvider } from "../db/audio-lab-assets.ts";

const MAX_AUDIO_BYTES = 30 * 1024 * 1024;

export interface StoredAudioLabFile {
  storageProvider: AudioLabStorageProvider;
  storagePath: string;
  contentType: string;
  bytes: number;
}

function dataDirectory(): string {
  return process.env.MELODYVISION_DATA_DIR?.trim()
    || path.join(/* turbopackIgnore: true */ process.cwd(), "data");
}

function requiredSupabaseStorageConfig() {
  const baseUrl = process.env.SUPABASE_URL?.trim().replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = process.env.SUPABASE_AUDIO_LAB_BUCKET?.trim() || "audio-lab";
  if (!baseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for Audio Lab storage");
  }
  return { baseUrl, serviceRoleKey, bucket };
}

function encodePath(value: string): string {
  return value.split("/").map(encodeURIComponent).join("/");
}

function validateAudioBytes(bytes: Buffer): void {
  if (bytes.byteLength === 0) throw new Error("音频服务返回了空文件");
  if (bytes.byteLength > MAX_AUDIO_BYTES) throw new Error("生成音频超过 30MB，无法保存");
}

export async function materializeSeedAudio(input: {
  audioBase64?: string | null;
  audioUrl?: string | null;
  fetcher?: typeof fetch;
}): Promise<{ bytes: Buffer; contentType: string }> {
  if (input.audioBase64) {
    const bytes = Buffer.from(input.audioBase64.replace(/\s/g, ""), "base64");
    validateAudioBytes(bytes);
    return { bytes, contentType: "audio/mpeg" };
  }
  if (!input.audioUrl) throw new Error("音频服务响应中没有可保存的音频");
  const url = new URL(input.audioUrl);
  if (url.protocol !== "https:") throw new Error("音频服务返回了不安全的下载地址");
  const response = await (input.fetcher || fetch)(url, {
    headers: { Accept: "audio/*,application/octet-stream" },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) throw new Error(`下载生成音频失败（HTTP ${response.status}）`);
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > MAX_AUDIO_BYTES) throw new Error("生成音频超过 30MB，无法保存");
  const bytes = Buffer.from(await response.arrayBuffer());
  validateAudioBytes(bytes);
  const contentType = response.headers.get("content-type") || "audio/mpeg";
  if (!contentType.startsWith("audio/") && contentType !== "application/octet-stream") {
    throw new Error("音频服务返回了非音频文件");
  }
  return { bytes, contentType: contentType === "application/octet-stream" ? "audio/mpeg" : contentType };
}

async function storeLocally(bytes: Buffer, assetId: string, contentType: string): Promise<StoredAudioLabFile> {
  const relativePath = path.join("audio-lab", `${assetId}.mp3`);
  const absolutePath = path.join(dataDirectory(), relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, bytes);
  return {
    storageProvider: "local",
    storagePath: relativePath,
    contentType,
    bytes: bytes.byteLength,
  };
}

async function storeInSupabase(bytes: Buffer, assetId: string, contentType: string): Promise<StoredAudioLabFile> {
  const { baseUrl, serviceRoleKey, bucket } = requiredSupabaseStorageConfig();
  const month = new Date().toISOString().slice(0, 7);
  const storagePath = `tracks/${month}/${assetId}.mp3`;
  const objectPath = `${encodeURIComponent(bucket)}/${encodePath(storagePath)}`;
  const response = await fetch(`${baseUrl}/storage/v1/object/${objectPath}`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": contentType,
      "x-upsert": "false",
    },
    body: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  });
  if (!response.ok) {
    throw new Error(`Audio Lab storage upload failed (${response.status}): ${await response.text()}`);
  }
  return {
    storageProvider: "supabase",
    storagePath,
    contentType,
    bytes: bytes.byteLength,
  };
}

export async function persistAudioLabFile(
  bytes: Buffer,
  assetId: string,
  contentType = "audio/mpeg"
): Promise<StoredAudioLabFile> {
  validateAudioBytes(bytes);
  return usesSupabaseDatabase()
    ? storeInSupabase(bytes, assetId, contentType)
    : storeLocally(bytes, assetId, contentType);
}

export async function readAudioLabFile(file: StoredAudioLabFile): Promise<Buffer> {
  if (file.storageProvider === "local") {
    const root = path.resolve(dataDirectory());
    const target = path.resolve(root, file.storagePath);
    if (!target.startsWith(`${root}${path.sep}`)) throw new Error("Invalid Audio Lab storage path");
    return readFile(target);
  }
  const { baseUrl, serviceRoleKey, bucket } = requiredSupabaseStorageConfig();
  const response = await fetch(
    `${baseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${encodePath(file.storagePath)}`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    }
  );
  if (!response.ok) throw new Error(`Audio Lab storage read failed (${response.status})`);
  return Buffer.from(await response.arrayBuffer());
}

export function sliceAudioRange(
  bytes: Buffer,
  rangeHeader: string | null
): { body: Buffer; status: 200 | 206; contentRange?: string } {
  if (!rangeHeader) return { body: bytes, status: 200 };
  const match = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return { body: bytes, status: 200 };
  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Number(match[2]) : bytes.byteLength - 1;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= bytes.byteLength) {
    return { body: bytes, status: 200 };
  }
  const safeEnd = Math.min(end, bytes.byteLength - 1);
  return {
    body: bytes.subarray(start, safeEnd + 1),
    status: 206,
    contentRange: `bytes ${start}-${safeEnd}/${bytes.byteLength}`,
  };
}
