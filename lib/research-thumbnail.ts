export function isAllowedResearchImageUrl(
  value: string,
  configuredHosts = process.env.RESEARCH_IMAGE_HOSTS || ""
): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;

  const configured = configuredHosts
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  const hostname = url.hostname.toLowerCase();
  const isSupabaseObject = hostname.endsWith(".supabase.co")
    && url.pathname.startsWith("/storage/v1/object/public/");
  return isSupabaseObject || configured.includes(hostname);
}

export function buildResearchThumbnailUrl(value: string): string {
  if (!value.startsWith("https://")) return value;
  try {
    const url = new URL(value);
    if (
      url.hostname.endsWith(".supabase.co")
      && url.pathname.startsWith("/storage/v1/object/public/")
    ) {
      url.pathname = url.pathname.replace(
        "/storage/v1/object/public/",
        "/storage/v1/render/image/public/"
      );
      url.searchParams.set("width", "720");
      url.searchParams.set("height", "405");
      url.searchParams.set("resize", "contain");
      url.searchParams.set("quality", "60");
      return url.toString();
    }
  } catch {
    return value;
  }
  return `/api/research/thumbnail?source=${encodeURIComponent(value)}`;
}
