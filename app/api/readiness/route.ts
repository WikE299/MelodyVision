import { getDatabase, usesSupabaseDatabase } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 35;

async function databaseStatus() {
  try {
    const database = await getDatabase();
    const schemaChecks = [
      "SELECT protocol_version FROM study_trials LIMIT 0",
      "SELECT immersion_score, satisfaction_score FROM artwork_evaluations LIMIT 0",
      "SELECT id FROM labeled_comparisons LIMIT 0",
      "SELECT id FROM manipulation_checks LIMIT 0",
    ];
    for (const query of schemaChecks) {
      await database.prepare(query).all();
    }
    return { status: "ok", provider: database.provider };
  } catch (error) {
    console.error("Readiness database check failed:", error);
    return {
      status: "unavailable",
      provider: usesSupabaseDatabase() ? "supabase" : "sqlite",
    };
  }
}

async function audioAnalysisStatus(request: Request) {
  if (process.env.AUDIO_ANALYSIS_PROVIDER === "vercel-python") {
    try {
      const response = await fetch(new URL("/api/audio-profile", request.url), {
        cache: "no-store",
        signal: AbortSignal.timeout(25_000),
      });
      return {
        status: response.ok ? "ok" : "warming",
        provider: "vercel-python",
        httpStatus: response.status,
      };
    } catch (error) {
      console.error("Readiness Python audio check failed:", error);
      return { status: "warming", provider: "vercel-python" };
    }
  }

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
    return {
      status: response.ok ? "ok" : "warming",
      provider: "external",
      httpStatus: response.status,
    };
  } catch (error) {
    console.error("Readiness audio check failed:", error);
    return { status: "warming", provider: "external" };
  }
}

export async function GET(request: Request) {
  const [database, audioAnalysis] = await Promise.all([
    databaseStatus(),
    audioAnalysisStatus(request),
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
