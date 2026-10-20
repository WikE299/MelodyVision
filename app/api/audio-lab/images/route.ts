import { isAudioLabRequestAllowed } from "@/lib/audio-lab/access";
import { loadAudioLabImageAssets } from "@/lib/audio-lab/image-assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAudioLabRequestAllowed(request)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  try {
    return Response.json(
      { images: await loadAudioLabImageAssets() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Audio Lab image library failed", error);
    return Response.json({ error: "实验图片库暂时无法读取" }, { status: 500 });
  }
}
