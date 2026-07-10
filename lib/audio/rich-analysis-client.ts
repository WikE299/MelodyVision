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

export async function requestRichMusicProfile(
  file: File,
  request: RichAnalysisRequest
): Promise<MusicProfile> {
  const formData = new FormData();
  formData.append("audio", file, file.name);
  formData.append("sessionId", request.sessionId);
  formData.append("sourceKind", request.sourceKind);
  if (request.catalogItemId) formData.append("catalogItemId", request.catalogItemId);

  const response = await fetch("/api/analyze", {
    method: "POST",
    body: formData,
  });
  const data = (await response.json().catch(() => ({}))) as RichAnalysisResponse;
  if (!response.ok || !data.profile || data.profile.schemaVersion !== "2.0.0") {
    throw new Error(data.error || "Rich audio analysis unavailable");
  }
  return data.profile;
}
