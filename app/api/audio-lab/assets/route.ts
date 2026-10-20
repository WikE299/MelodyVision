import { isAudioLabRequestAllowed } from "@/lib/audio-lab/access";
import { listAudioLabAssets } from "@/lib/db/audio-lab-assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAudioLabRequestAllowed(request)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const assets = (await listAudioLabAssets()).map((asset) => ({
      ...asset,
      audioUrl: `/api/audio-lab/assets/${encodeURIComponent(asset.id)}/file`,
      downloadUrl: `/api/audio-lab/assets/${encodeURIComponent(asset.id)}/file?download=1`,
    }));
    return Response.json({ assets }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Audio Lab asset list failed", error);
    return Response.json({ error: "音乐资产区暂时无法读取" }, { status: 500 });
  }
}
