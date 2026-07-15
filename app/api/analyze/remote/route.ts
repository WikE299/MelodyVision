export const runtime = "nodejs";
export const maxDuration = 180;

function serviceUrl(path: string): string {
  const base = process.env.AUDIO_ANALYSIS_URL?.trim() || "http://127.0.0.1:8001";
  return `${base.replace(/\/$/, "")}${path}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const response = await fetch(serviceUrl("/analyze-remote"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(180_000),
    });
    return new Response(await response.text(), {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") || "application/json" },
    });
  } catch (error) {
    console.error("Remote audio analysis proxy failed:", error);
    return Response.json({ error: "Rich audio analysis unavailable" }, { status: 503 });
  }
}
