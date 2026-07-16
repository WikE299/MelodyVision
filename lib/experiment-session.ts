const SESSION_STORAGE_KEY = "melodyvisionSessionId";

export async function getExperimentSessionId(): Promise<string> {
  const existing = localStorage.getItem(SESSION_STORAGE_KEY);
  const response = await fetch("/api/experiment/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(existing ? { sessionId: existing } : {}),
  });
  const data = await response.json();

  if (!response.ok || typeof data.sessionId !== "string") {
    throw new Error(data.error || "实验 session 创建失败");
  }

  if (!existing) localStorage.setItem(SESSION_STORAGE_KEY, data.sessionId);
  return data.sessionId;
}
