import { randomUUID } from "node:crypto";

export const MAX_AUDIO_UPLOAD_BYTES = 20 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set(["mp3", "wav", "flac", "ogg"]);
const ALLOWED_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/flac",
  "audio/x-flac",
  "audio/ogg",
  "application/ogg",
  "application/octet-stream",
]);
const MANAGED_AUDIO_PATH =
  /^incoming\/\d{4}-\d{2}-\d{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp3|wav|flac|ogg)$/;

export interface AudioUploadTicketRequest {
  fileName: string;
  mimeType: string;
  byteSize: number;
}

export interface AudioUploadTicket {
  storagePath: string;
  uploadUrl: string;
  expiresInSeconds: number;
}

export class AudioUploadValidationError extends Error {}

function requiredSupabaseStorageConfig() {
  const baseUrl = process.env.SUPABASE_URL?.trim().replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = process.env.SUPABASE_AUDIO_BUCKET?.trim() || "audio-analysis";
  if (!baseUrl || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for audio storage"
    );
  }
  return { baseUrl, serviceRoleKey, bucket };
}

function extensionFor(fileName: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase() || "";
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new AudioUploadValidationError("Unsupported audio file extension");
  }
  return extension;
}

export function validateAudioUploadTicketRequest(
  value: unknown
): AudioUploadMetadata {
  if (!value || typeof value !== "object") {
    throw new AudioUploadValidationError("Audio upload metadata is required");
  }
  const input = value as Partial<AudioUploadTicketRequest>;
  const fileName = typeof input.fileName === "string" ? input.fileName.trim() : "";
  const mimeType = typeof input.mimeType === "string" ? input.mimeType.trim().toLowerCase() : "";
  const byteSize = Number(input.byteSize);

  if (!fileName || fileName.length > 240) {
    throw new AudioUploadValidationError("Invalid audio file name");
  }
  if (!Number.isInteger(byteSize) || byteSize <= 0 || byteSize > MAX_AUDIO_UPLOAD_BYTES) {
    throw new AudioUploadValidationError("Audio file must be between 1 byte and 20 MB");
  }
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new AudioUploadValidationError("Unsupported audio MIME type");
  }

  return {
    fileName,
    mimeType,
    byteSize,
    extension: extensionFor(fileName),
  };
}

interface AudioUploadMetadata extends AudioUploadTicketRequest {
  extension: string;
}

function encodedObjectPath(value: string): string {
  return value.split("/").map(encodeURIComponent).join("/");
}

export function isManagedAudioStoragePath(value: string): boolean {
  return MANAGED_AUDIO_PATH.test(value);
}

export async function createAudioUploadTicket(
  value: unknown
): Promise<AudioUploadTicket> {
  const metadata = validateAudioUploadTicketRequest(value);
  const { baseUrl, serviceRoleKey, bucket } = requiredSupabaseStorageConfig();
  const day = new Date().toISOString().slice(0, 10);
  const storagePath = `incoming/${day}/${randomUUID()}.${metadata.extension}`;
  const objectPath = `${encodeURIComponent(bucket)}/${encodedObjectPath(storagePath)}`;

  const response = await fetch(
    `${baseUrl}/storage/v1/object/upload/sign/${objectPath}`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: "{}",
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    }
  );
  if (!response.ok) {
    throw new Error(
      `Supabase signed audio upload failed (${response.status}): ${await response.text()}`
    );
  }

  const data = (await response.json()) as { url?: string };
  if (!data.url) {
    throw new Error("Supabase did not return a signed audio upload URL");
  }
  const uploadUrl = data.url.startsWith("http")
    ? data.url
    : `${baseUrl}/storage/v1${data.url.startsWith("/") ? "" : "/"}${data.url}`;

  return {
    storagePath,
    uploadUrl,
    expiresInSeconds: 7200,
  };
}

export async function removeStoredAudio(storagePath: string): Promise<void> {
  if (!isManagedAudioStoragePath(storagePath)) {
    throw new AudioUploadValidationError("Invalid managed audio storage path");
  }
  const { baseUrl, serviceRoleKey, bucket } = requiredSupabaseStorageConfig();
  const response = await fetch(
    `${baseUrl}/storage/v1/object/${encodeURIComponent(bucket)}`,
    {
      method: "DELETE",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prefixes: [storagePath] }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    }
  );
  if (!response.ok && response.status !== 404) {
    throw new Error(
      `Supabase audio cleanup failed (${response.status}): ${await response.text()}`
    );
  }
}
