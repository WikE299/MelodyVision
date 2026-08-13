const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function normalizeHost(value: string): string {
  const host = value.split(",")[0]?.trim().toLowerCase() || "";
  if (host.startsWith("[")) {
    const closingBracket = host.indexOf("]");
    return closingBracket >= 0 ? host.slice(1, closingBracket) : host;
  }
  return host.split(":")[0] || "";
}

export function isQuestionnaireLabRequest(
  headers: Headers,
  enabled = process.env.QUESTIONNAIRE_LAB_ENABLED?.trim().toLowerCase() === "true"
): boolean {
  return enabled && LOCAL_HOSTS.has(normalizeHost(headers.get("host") || ""));
}
