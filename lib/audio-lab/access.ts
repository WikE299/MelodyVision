export function isAudioLabEnabled(
  environment: Record<string, string | undefined> = process.env
): boolean {
  const configured = environment.AUDIO_LAB_ENABLED?.trim().toLowerCase();
  if (configured === "true") return true;
  if (configured === "false") return false;
  return environment.NODE_ENV !== "production";
}

export function isAudioLabRequestAllowed(
  request: Request,
  environment: Record<string, string | undefined> = process.env
): boolean {
  if (!isAudioLabEnabled(environment)) return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
