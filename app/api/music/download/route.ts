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
  return value.replace(/[^\p{L}\p{N}\s._-]/gu, "").trim() || "jamendo-track";
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
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as JamendoResponse;
  return data.results?.[0] || null;
}

export async function GET(request: Request) {
  if (!getJamendoClientId()) {
    return Response.json({ error: "JAMENDO_CLIENT_ID is not configured" }, { status: 503 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id")?.trim();
  if (!id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  const track = await getTrack(id);
  if (!track) {
    return Response.json({ error: "Track not found" }, { status: 404 });
  }
  if (!track.audiodownload_allowed || !track.audiodownload) {
    return Response.json({ error: "Track download is not allowed" }, { status: 403 });
  }

  const audioRes = await fetch(track.audiodownload, {
    headers: { Accept: "audio/mpeg,audio/*" },
  });
  if (!audioRes.ok || !audioRes.body) {
    return Response.json({ error: `Audio download failed with ${audioRes.status}` }, { status: 502 });
  }

  return new Response(audioRes.body, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Disposition": `attachment; filename="${safeFilename(track.name || id)}.mp3"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
