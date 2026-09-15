const LOCAL_RESEARCH_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function normalizeHost(value: string): string {
  const host = value.split(",")[0]?.trim().toLowerCase() || "";
  if (host.startsWith("[")) {
    const closingBracket = host.indexOf("]");
    return closingBracket >= 0 ? host.slice(1, closingBracket) : host;
  }
  return host.split(":")[0] || "";
}

export function isLocalResearchRequest(
  headers: Headers,
  enabled = process.env.RESEARCH_DASHBOARD_ENABLED?.trim().toLowerCase() === "true"
): boolean {
  if (!enabled) return false;
  return LOCAL_RESEARCH_HOSTS.has(normalizeHost(headers.get("host") || ""));
}

export function isLocalResearchMutationRequest(
  headers: Headers,
  enabled = process.env.RESEARCH_DASHBOARD_ENABLED?.trim().toLowerCase() === "true"
): boolean {
  if (!isLocalResearchRequest(headers, enabled)) return false;
  const origin = headers.get("origin");
  if (!origin) return true;
  try {
    return LOCAL_RESEARCH_HOSTS.has(new URL(origin).hostname.toLowerCase());
  } catch {
    return false;
  }
}
