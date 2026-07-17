import { isAllowedJamendoAudioUrl } from "@/lib/audio/external-music";

export const runtime = "nodejs";

const JAMENDO_TRACKS_URL = "https://api.jamendo.com/v3.0/tracks/";

interface JamendoTrack {
  id?: string;
  name?: string;
  audiodownload?: string;
  audiodownload_allowed?: boolean;
}

interface JamendoResponse {
  results?: JamendoTrack[];
}

function getJamendoClientId() {
  return process.env.JAMENDO_CLIENT_ID?.trim() || "";
}

function safeFilename(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "jamendo-track";
}

async function getTrack(id: string) {
  const params = new URLSearchParams({
    client_id: getJamendoClientId(),
    format: "json",
    id,
    audiodlformat: "mp31",
    limit: "1",
  });
  const res = await fetch(`${JAMENDO_TRACKS_URL}?${params.toString()}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as JamendoResponse;
  return data.results?.[0] || null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id")?.trim();
  const source = url.searchParams.get("source")?.trim() || "";
  if (!id && !source) {
    return Response.json({ error: "id or source is required" }, { status: 400 });
  }

  let track: JamendoTrack | null;
  if (source) {
    if (!isAllowedJamendoAudioUrl(source)) {
      return Response.json({ error: "Unsupported audio source" }, { status: 400 });
    }
    track = {
      id,
      name: id || "jamendo-preview",
      audiodownload: source,
      audiodownload_allowed: true,
    };
  } else {
    if (!getJamendoClientId()) {
      return Response.json({ error: "JAMENDO_CLIENT_ID is not configured" }, { status: 503 });
    }
    try {
      track = await getTrack(id!);
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? `Track lookup failed: ${error.message}` : "Track lookup failed" },
        { status: 502 }
      );
    }
  }
  if (!track) {
    return Response.json({ error: "Track not found" }, { status: 404 });
  }
  if (!track.audiodownload_allowed || !track.audiodownload) {
    return Response.json({ error: "Track download is not allowed" }, { status: 403 });
  }

  let audioRes: Response;
  try {
    audioRes = await fetch(track.audiodownload, {
      headers: { Accept: "audio/mpeg,audio/*" },
      signal: AbortSignal.timeout(45_000),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? `Audio download failed: ${error.message}` : "Audio download failed" },
      { status: 502 }
    );
  }
  if (!audioRes.ok) {
    return Response.json({ error: `Audio download failed with ${audioRes.status}` }, { status: 502 });
  }

  const audio = new Uint8Array(await audioRes.arrayBuffer());
  if (audio.byteLength < 1024) {
    return Response.json({ error: "Downloaded audio is empty or invalid" }, { status: 502 });
  }

  return new Response(audio, {
    headers: {
      "Content-Type": audioRes.headers.get("content-type")?.startsWith("audio/")
        ? audioRes.headers.get("content-type")!
        : "audio/mpeg",
      "Content-Length": String(audio.byteLength),
      "Content-Disposition": `attachment; filename="${safeFilename(track.name || id || "jamendo-track")}.mp3"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
