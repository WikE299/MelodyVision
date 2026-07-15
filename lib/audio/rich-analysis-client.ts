import type { AudioSourceKind, MusicProfile } from "../contracts";

interface RichAnalysisRequest {
  sessionId: string;
  sourceKind: AudioSourceKind;
  catalogItemId?: string;
}

interface RichAnalysisResponse {
  profile?: MusicProfile;
  error?: string;
}

interface RemoteMusicSource {
  sourceUrl: string;
  fileName: string;
  mimeType?: string;
}

const ANALYSIS_TIMEOUT_MS = 180_000;

function analysisBaseUrl(): string {
  return process.env.NEXT_PUBLIC_AUDIO_ANALYSIS_URL?.trim().replace(/\/$/, "") || "";
}

function analysisUrl(path: string): string {
  const baseUrl = analysisBaseUrl();
  if (baseUrl) return `${baseUrl}${path}`;
  if (path === "/analyze-remote") return "/api/analyze/remote";
  return "/api/analyze";
}

async function readProfile(response: Response): Promise<MusicProfile> {
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  const wrapped = data as RichAnalysisResponse;
  const profile = wrapped.profile || (data.schemaVersion === "2.0.0" ? data as unknown as MusicProfile : undefined);
  if (!response.ok || !profile || profile.schemaVersion !== "2.0.0") {
    const error = typeof data.error === "string"
      ? data.error
      : typeof data.detail === "string"
        ? data.detail
      : "Rich audio analysis unavailable";
    throw new Error(error);
  }
  return profile;
}

export async function requestRichMusicProfile(
  file: File,
  request: RichAnalysisRequest
): Promise<MusicProfile> {
  const formData = new FormData();
  formData.append("audio", file, file.name);
  formData.append("sessionId", request.sessionId);
  formData.append("sourceKind", request.sourceKind);
  if (request.catalogItemId) formData.append("catalogItemId", request.catalogItemId);

  const response = await fetch(analysisUrl("/analyze"), {
    method: "POST",
    body: formData,
    signal: AbortSignal.timeout(ANALYSIS_TIMEOUT_MS),
  });
  return readProfile(response);
}

export async function requestRemoteMusicProfile(
  source: RemoteMusicSource,
  request: RichAnalysisRequest
): Promise<MusicProfile> {
  const response = await fetch(analysisUrl("/analyze-remote"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sourceUrl: source.sourceUrl,
      fileName: source.fileName,
      mimeType: source.mimeType || "audio/mpeg",
      sessionId: request.sessionId,
      sourceKind: request.sourceKind,
      catalogItemId: request.catalogItemId,
    }),
    signal: AbortSignal.timeout(ANALYSIS_TIMEOUT_MS),
  });
  return readProfile(response);
}

export async function warmRichAnalysisService(): Promise<boolean> {
  const response = await fetch(analysisUrl("/health"), {
    cache: "no-store",
    signal: AbortSignal.timeout(ANALYSIS_TIMEOUT_MS),
  });
  return response.ok;
}
