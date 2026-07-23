import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { isLocalResearchRequest } from "@/lib/research-access";
import { isAllowedResearchImageUrl } from "@/lib/research-thumbnail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SOURCE_BYTES = 20 * 1024 * 1024;

function cachePathFor(source: string): string {
  const hash = createHash("sha256").update(source).digest("hex");
  return path.join(process.cwd(), "data", "research-cache", "thumbnails", `${hash}.webp`);
}

function imageResponse(bytes: Buffer) {
  return new Response(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}

export async function GET(request: Request) {
  if (!isLocalResearchRequest(request.headers)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const source = new URL(request.url).searchParams.get("source") || "";
  if (!isAllowedResearchImageUrl(source)) {
    return Response.json({ error: "Image source is not allowed" }, { status: 400 });
  }

  const cachePath = cachePathFor(source);
  try {
    return imageResponse(await readFile(cachePath));
  } catch {
    // The first request creates the local thumbnail cache.
  }

  try {
    const response = await fetch(source, {
      headers: { Accept: "image/*" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Image download failed (${response.status})`);
    const contentType = response.headers.get("content-type") || "";
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (!contentType.startsWith("image/") || contentLength > MAX_SOURCE_BYTES) {
      throw new Error("Invalid image response");
    }
    const sourceBytes = Buffer.from(await response.arrayBuffer());
    if (sourceBytes.byteLength > MAX_SOURCE_BYTES) throw new Error("Image is too large");

    const thumbnail = await sharp(sourceBytes)
      .rotate()
      .resize({ width: 720, height: 405, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 74 })
      .toBuffer();
    await mkdir(path.dirname(cachePath), { recursive: true });
    await writeFile(cachePath, thumbnail);
    return imageResponse(thumbnail);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Thumbnail generation failed" },
      { status: 502 }
    );
  }
}
