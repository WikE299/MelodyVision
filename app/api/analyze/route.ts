import type { AudioSourceKind } from "@/lib/contracts";

export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const ALLOWED_SOURCE_KINDS = new Set<AudioSourceKind>(["upload", "preset", "search"]);
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

function serviceUrl(path: string): string {
  const base = process.env.AUDIO_ANALYSIS_URL?.trim() || "http://127.0.0.1:8001";
  return `${base.replace(/\/$/, "")}${path}`;
}

export async function GET() {
  try {
    const response = await fetch(serviceUrl("/health"), {
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    const service = await response.json();
    return Response.json({ status: response.ok ? "ok" : "unavailable", service }, { status: response.status });
  } catch (error) {
    console.error("Audio analysis health check failed:", error);
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("audio");
    const sourceKindValue = formData.get("sourceKind");
    const sourceKind = typeof sourceKindValue === "string" ? sourceKindValue : "upload";
    const sessionIdValue = formData.get("sessionId");
    const sessionId = typeof sessionIdValue === "string" && sessionIdValue.trim()
      ? sessionIdValue.trim()
      : "anonymous";
    const catalogItemIdValue = formData.get("catalogItemId");
    const catalogItemId = typeof catalogItemIdValue === "string" ? catalogItemIdValue.trim() : "";

    if (!(file instanceof File)) {
      return Response.json({ error: "No audio file provided" }, { status: 400 });
    }
    if (!ALLOWED_SOURCE_KINDS.has(sourceKind as AudioSourceKind)) {
      return Response.json({ error: "Invalid audio source kind" }, { status: 400 });
    }
    if (!ALLOWED_MIME_TYPES.has(file.type) && !file.name.match(/\.(mp3|wav|flac|ogg)$/i)) {
      return Response.json({ error: "Unsupported audio format" }, { status: 400 });
    }
    if (file.size > MAX_AUDIO_BYTES) {
      return Response.json({ error: "File too large (max 20MB)" }, { status: 400 });
    }

    const upstreamForm = new FormData();
    upstreamForm.append("file", file, file.name);
    upstreamForm.append("sessionId", sessionId);
    upstreamForm.append("sourceKind", sourceKind);
    if (catalogItemId) upstreamForm.append("catalogItemId", catalogItemId);

    const response = await fetch(serviceUrl("/analyze"), {
      method: "POST",
      body: upstreamForm,
      cache: "no-store",
      signal: AbortSignal.timeout(90_000),
    });
    if (!response.ok) {
      const detail = await response.text();
      console.error(`Rich audio analysis failed (${response.status}):`, detail);
      return Response.json(
        { error: "Rich audio analysis unavailable", degraded: true },
        { status: 502 }
      );
    }

    return Response.json({ profile: await response.json(), mode: "rich" });
  } catch (error) {
    console.error("Audio analysis proxy failed:", error);
    return Response.json(
      { error: "Rich audio analysis unavailable", degraded: true },
      { status: 503 }
    );
  }
}
