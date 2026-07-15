import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { usesSupabaseDatabase } from "../db/index";

export interface StoredGeneratedImage {
  storagePath: string;
  publicUrl: string;
  bytes: number;
  contentType: string;
}

function extensionFor(contentType: string): string {
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  return "png";
}

function requiredSupabaseStorageConfig() {
  const baseUrl = process.env.SUPABASE_URL?.trim().replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = process.env.SUPABASE_GENERATED_BUCKET?.trim() || "generated";
  if (!baseUrl || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for generated image storage"
    );
  }
  return { baseUrl, serviceRoleKey, bucket };
}

function encodedObjectPath(value: string): string {
  return value.split("/").map(encodeURIComponent).join("/");
}

async function storeInSupabase(
  bytes: Buffer,
  runId: string,
  contentType: string
): Promise<StoredGeneratedImage> {
  const { baseUrl, serviceRoleKey, bucket } = requiredSupabaseStorageConfig();
  const storagePath = `artworks/${runId}.${extensionFor(contentType)}`;
  const objectPath = `${encodeURIComponent(bucket)}/${encodedObjectPath(storagePath)}`;
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
    throw new Error(`Supabase image upload failed (${response.status}): ${await response.text()}`);
  }
  return {
    storagePath,
    publicUrl: `${baseUrl}/storage/v1/object/public/${objectPath}`,
    bytes: bytes.length,
    contentType,
  };
}

async function storeLocally(
  bytes: Buffer,
  runId: string,
  contentType: string
): Promise<StoredGeneratedImage> {
  const fileName = `${runId}.${extensionFor(contentType)}`;
  const directory = path.join(process.cwd(), "public", "generated");
  const localPath = path.join(directory, fileName);
  await mkdir(directory, { recursive: true });
  await writeFile(localPath, bytes);
  return {
    storagePath: localPath,
    publicUrl: `/generated/${fileName}`,
    bytes: bytes.length,
    contentType,
  };
}

export async function persistGeneratedImage(
  remoteImageUrl: string,
  runId: string
): Promise<StoredGeneratedImage> {
  const response = await fetch(remoteImageUrl, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) {
    throw new Error(`Failed to download generated image: ${response.status}`);
  }
  const contentType = response.headers.get("content-type") || "image/png";
  const bytes = Buffer.from(await response.arrayBuffer());
  return usesSupabaseDatabase()
    ? storeInSupabase(bytes, runId, contentType)
    : storeLocally(bytes, runId, contentType);
}
