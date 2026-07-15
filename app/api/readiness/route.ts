import { getDatabase, usesSupabaseDatabase } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

async function databaseStatus() {
  try {
    const database = await getDatabase();
    const rows = await database.prepare("SELECT 1 AS ok").all();
    return { status: rows.length === 1 ? "ok" : "unavailable", provider: database.provider };
  } catch (error) {
    console.error("Readiness database check failed:", error);
    return {
      status: "unavailable",
      provider: usesSupabaseDatabase() ? "supabase" : "sqlite",
    };
  }
}

async function audioAnalysisStatus() {
  const baseUrl = (
    process.env.AUDIO_ANALYSIS_URL ||
    process.env.NEXT_PUBLIC_AUDIO_ANALYSIS_URL ||
    "http://127.0.0.1:8001"
  ).trim().replace(/\/$/, "");
  try {
    const response = await fetch(`${baseUrl}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    return { status: response.ok ? "ok" : "warming", httpStatus: response.status };
  } catch (error) {
    console.error("Readiness audio check failed:", error);
    return { status: "warming" };
  }
}

export async function GET() {
  const [database, audioAnalysis] = await Promise.all([
    databaseStatus(),
    audioAnalysisStatus(),
  ]);
  return Response.json({
    status: database.status === "ok" && audioAnalysis.status === "ok" ? "ready" : "warming",
    app: { status: "ok" },
    database,
    audioAnalysis,
    storage: {
      status: usesSupabaseDatabase()
        ? process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
          ? "configured"
          : "unavailable"
        : "local",
    },
  });
}
