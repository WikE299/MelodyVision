export function recordExperimentEvent(
  eventType: string,
  page: string,
  payload: Record<string, unknown> = {}
) {
  if (typeof window === "undefined") return;
  const sessionId = sessionStorage.getItem("experimentSessionId");
  if (!sessionId) return;

  void fetch("/api/experiment/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, eventType, page, payload }),
    keepalive: true,
  }).catch(() => undefined);
}
