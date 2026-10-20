import { isAudioLabRequestAllowed } from "@/lib/audio-lab/access";
import { getAudioLabAsset } from "@/lib/db/audio-lab-assets";
import { readAudioLabFile, sliceAudioRange } from "@/lib/storage/audio-lab";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAudioLabRequestAllowed(request)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const { id } = await params;
  const asset = await getAudioLabAsset(id);
  if (!asset) return Response.json({ error: "Audio asset not found" }, { status: 404 });

  try {
    const bytes = await readAudioLabFile(asset);
    const range = sliceAudioRange(bytes, request.headers.get("range"));
    const url = new URL(request.url);
    const headers = new Headers({
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
      "Content-Type": asset.contentType,
      "Content-Length": String(range.body.byteLength),
    });
    if (range.contentRange) headers.set("Content-Range", range.contentRange);
    if (url.searchParams.get("download") === "1") {
      const safeTitle = asset.sourceMusicTitle.replace(/[^\p{L}\p{N}\-_ ]/gu, "").trim() || "melodyvision-audio";
      headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(`${safeTitle}-${asset.id.slice(0, 8)}.mp3`)}`);
    }
    return new Response(Uint8Array.from(range.body), { status: range.status, headers });
  } catch (error) {
    console.error("Audio Lab asset read failed", { id, error });
    return Response.json({ error: "音乐文件暂时无法读取" }, { status: 404 });
  }
}
