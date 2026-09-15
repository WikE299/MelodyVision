import { isAllowedJamendoAudioUrl } from "@/lib/audio/external-music";
import {
  createAudioProxyResponse,
  getUpstreamAudioHeaders,
} from "@/lib/audio/jamendo-audio-proxy";

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
  const source = url.searchParams.get("source")?.trim()
    || request.headers.get("x-melodyvision-audio-source")?.trim()
    || "";
  if (!id && !source) {
    return Response.json({ error: "id or source is required" }, { status: 400 });
  }

  let track: JamendoTrack | null;
  if (source) {
    if (!isAllowedJamendoAudioUrl(source, id)) {
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

  let audioRes: Response | null = null;
  let downloadError: unknown;
  try {
    audioRes = await fetch(track.audiodownload, {
      headers: getUpstreamAudioHeaders(request),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (error) {
    downloadError = error;
  }

  // Search results include a short-lived signed URL. Use it for a fast first
  // request, then transparently refresh it by track id if it has expired.
  if ((!audioRes?.ok || !audioRes.body) && source && id && getJamendoClientId()) {
    try {
      const refreshedTrack = await getTrack(id);
      if (refreshedTrack?.audiodownload_allowed && refreshedTrack.audiodownload) {
        track = refreshedTrack;
        audioRes = await fetch(refreshedTrack.audiodownload, {
          headers: getUpstreamAudioHeaders(request),
          signal: AbortSignal.timeout(45_000),
        });
      }
    } catch (error) {
      downloadError = error;
    }
  }
  if (!audioRes?.ok || !audioRes.body) {
    const detail = downloadError instanceof Error
      ? `: ${downloadError.message}`
      : audioRes
        ? ` with ${audioRes.status}`
        : "";
    return Response.json({ error: `Audio download failed${detail}` }, { status: 502 });
  }

  const contentLength = Number(audioRes.headers.get("content-length") || 0);
  if (contentLength > 0 && contentLength < 1024 && audioRes.status !== 206) {
    return Response.json({ error: "Downloaded audio is empty or invalid" }, { status: 502 });
  }

  return createAudioProxyResponse(audioRes, track.name || id || "jamendo-track");
}
