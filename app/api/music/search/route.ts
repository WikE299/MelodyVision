import { getMusicSearchTags, type ExternalMusicResult } from "@/lib/audio/external-music";

export const runtime = "nodejs";

const JAMENDO_TRACKS_URL = "https://api.jamendo.com/v3.0/tracks/";

interface JamendoTrack {
  id?: string;
  name?: string;
  duration?: number;
  artist_name?: string;
  album_name?: string;
  license_ccurl?: string;
  audio?: string;
  audiodownload?: string;
  audiodownload_allowed?: boolean;
  shareurl?: string;
  album_image?: string;
  image?: string;
  musicinfo?: {
    tags?: {
      genres?: string[];
      instruments?: string[];
      vartags?: string[];
    };
  };
}

interface JamendoResponse {
  headers?: {
    status?: string;
    code?: number;
    error_message?: string;
  };
  results?: JamendoTrack[];
}

function getJamendoClientId() {
  return process.env.JAMENDO_CLIENT_ID?.trim() || "";
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildJamendoParams(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() || "";
  const tagIds = url.searchParams.get("tags")?.split(",").map((tag) => tag.trim()).filter(Boolean) || [];
  const selectedTags = getMusicSearchTags(tagIds);
  const fuzzyTags = unique(selectedTags.flatMap((tag) => tag.jamendoTags || []));
  const speeds = unique(selectedTags.map((tag) => tag.speed || ""));
  const vocalModes = unique(selectedTags.map((tag) => tag.vocalinstrumental || ""));

  const params = new URLSearchParams({
    client_id: getJamendoClientId(),
    format: "json",
    limit: "10",
    include: "licenses musicinfo",
    audioformat: "mp31",
    audiodlformat: "mp31",
    imagesize: "200",
    groupby: "artist_id",
    durationbetween: "20_420",
  });

  if (query) params.set("search", query);
  if (fuzzyTags.length > 0) params.set("fuzzytags", fuzzyTags.join(" "));
  if (speeds.length > 0) params.set("speed", speeds.join(" "));
  if (vocalModes.length === 1) params.set("vocalinstrumental", vocalModes[0]);
  if (!query && fuzzyTags.length === 0) params.set("featured", "1");

  return params;
}

function mapTrack(track: JamendoTrack): ExternalMusicResult | null {
  if (!track.id || !track.name || !track.artist_name || !track.audio) return null;

  const tags = unique([
    ...(track.musicinfo?.tags?.genres || []),
    ...(track.musicinfo?.tags?.instruments || []),
    ...(track.musicinfo?.tags?.vartags || []),
  ]).slice(0, 8);

  return {
    id: track.id,
    provider: "jamendo",
    title: track.name,
    artist: track.artist_name,
    album: track.album_name || undefined,
    durationSeconds: Number(track.duration || 0),
    tags,
    license: track.license_ccurl ? "Creative Commons" : "Jamendo",
    licenseUrl: track.license_ccurl || undefined,
    sourceUrl: track.shareurl || `https://www.jamendo.com/track/${track.id}`,
    artworkUrl: track.album_image || track.image || undefined,
    previewUrl: track.audio,
    downloadable: Boolean(track.audiodownload_allowed && track.audiodownload),
  };
}

export async function GET(request: Request) {
  const clientId = getJamendoClientId();
  if (!clientId) {
    return Response.json(
      {
        error: "JAMENDO_CLIENT_ID is not configured",
        results: [],
      },
      { status: 503 }
    );
  }

  const params = buildJamendoParams(request);
  const res = await fetch(`${JAMENDO_TRACKS_URL}?${params.toString()}`, {
    headers: {
      Accept: "application/json",
    },
    next: { revalidate: 86400 },
  });

  if (!res.ok) {
    return Response.json(
      { error: `Jamendo search failed with ${res.status}`, results: [] },
      { status: 502 }
    );
  }

  const data = (await res.json()) as JamendoResponse;
  if (data.headers?.status && data.headers.status !== "success") {
    return Response.json(
      { error: data.headers.error_message || "Jamendo search failed", results: [] },
      { status: 502 }
    );
  }

  const results = (data.results || [])
    .map(mapTrack)
    .filter((item): item is ExternalMusicResult => Boolean(item))
    .filter((item) => item.downloadable);

  return Response.json({ provider: "jamendo", results });
}
