import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { audioCatalog } from "@/lib/audio/catalog";

export const runtime = "nodejs";

function contentType(filePath: string): string {
  if (filePath.toLowerCase().endsWith(".ogg")) return "audio/ogg";
  if (filePath.toLowerCase().endsWith(".wav")) return "audio/wav";
  if (filePath.toLowerCase().endsWith(".flac")) return "audio/flac";
  return "audio/mpeg";
}

async function availableFile(item: (typeof audioCatalog)[number]): Promise<string> {
  for (const publicPath of [item.originalFile, item.file]) {
    const filePath = path.join(process.cwd(), "public", publicPath.replace(/^\//, ""));
    try {
      if ((await stat(filePath)).isFile()) return filePath;
    } catch {
      // The deployed build may intentionally omit an original recording.
    }
  }
  throw new Error("Preset audio is unavailable");
}

function byteRange(header: string | null, size: number): { start: number; end: number } | null {
  const match = header?.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return null;
  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= size) {
    return null;
  }
  return { start, end: Math.min(end, size - 1) };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const item = audioCatalog.find((candidate) => candidate.id === id);
  if (!item) return Response.json({ error: "Preset audio not found" }, { status: 404 });

  try {
    const filePath = await availableFile(item);
    const file = await readFile(filePath);
    const range = byteRange(request.headers.get("range"), file.byteLength);
    const headers = new Headers({
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600",
      "Content-Type": contentType(filePath),
    });
    if (!range) {
      headers.set("Content-Length", String(file.byteLength));
      return new Response(file, { headers });
    }

    const chunk = file.subarray(range.start, range.end + 1);
    headers.set("Content-Length", String(chunk.byteLength));
    headers.set("Content-Range", `bytes ${range.start}-${range.end}/${file.byteLength}`);
    return new Response(chunk, { status: 206, headers });
  } catch {
    return Response.json({ error: "Preset audio unavailable" }, { status: 404 });
  }
}
