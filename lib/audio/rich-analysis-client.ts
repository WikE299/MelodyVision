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

interface AudioUploadTicket {
  storagePath: string;
  uploadUrl: string;
}

function usesVercelPythonAnalyzer(): boolean {
  return process.env.NEXT_PUBLIC_AUDIO_ANALYSIS_PROVIDER === "vercel-python";
}

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

async function createUploadTicket(file: File): Promise<AudioUploadTicket> {
  const response = await fetch("/api/audio/upload-ticket", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      byteSize: file.size,
    }),
  });
  const data = (await response.json().catch(() => ({}))) as Partial<AudioUploadTicket> & {
    error?: string;
  };
  if (!response.ok || !data.storagePath || !data.uploadUrl) {
    throw new Error(data.error || "Unable to prepare the audio upload");
  }
  return {
    storagePath: data.storagePath,
    uploadUrl: data.uploadUrl,
  };
}

async function uploadToSignedUrl(file: File, uploadUrl: string): Promise<void> {
  const formData = new FormData();
  formData.append("cacheControl", "3600");
  formData.append("", file, file.name);
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "x-upsert": "false" },
    body: formData,
    signal: AbortSignal.timeout(ANALYSIS_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Audio upload failed (${response.status})`);
  }
}

async function cleanupUploadedAudio(storagePath: string): Promise<void> {
  await fetch("/api/audio/upload-ticket", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storagePath }),
    keepalive: true,
  }).catch(() => undefined);
}

export async function requestRichMusicProfile(
  file: File,
  request: RichAnalysisRequest
): Promise<MusicProfile> {
  if (usesVercelPythonAnalyzer()) {
    const ticket = await createUploadTicket(file);
    try {
      await uploadToSignedUrl(file, ticket.uploadUrl);
      const response = await fetch("/api/audio-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storagePath: ticket.storagePath,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          sessionId: request.sessionId,
          sourceKind: request.sourceKind,
          catalogItemId: request.catalogItemId,
        }),
        signal: AbortSignal.timeout(ANALYSIS_TIMEOUT_MS),
      });
      return readProfile(response);
    } finally {
      void cleanupUploadedAudio(ticket.storagePath);
    }
  }

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
  const response = await fetch(
    usesVercelPythonAnalyzer() ? "/api/audio-profile" : analysisUrl("/analyze-remote"),
    {
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
    }
  );
  return readProfile(response);
}

export async function warmRichAnalysisService(): Promise<boolean> {
  const response = await fetch(
    usesVercelPythonAnalyzer() ? "/api/audio-profile" : analysisUrl("/health"),
    {
      cache: "no-store",
      signal: AbortSignal.timeout(ANALYSIS_TIMEOUT_MS),
    }
  );
  return response.ok;
}
