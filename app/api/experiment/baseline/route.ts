import { after, type NextRequest } from "next/server";
import { getGenerationRunResult } from "@/lib/db/generation-runs";
import { getAudioAnalysisForTrial, insertInteractionEvent } from "@/lib/db/research-data";
import {
  BaselineNotEligibleError,
  claimBaselineJob,
  failBaselineJob,
  getBaselineJob,
  getStudyTrial,
} from "@/lib/db/study-trials";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const trialId = request.nextUrl.searchParams.get("trialId")?.trim() || "";
  if (!trialId) return Response.json({ error: "trialId is required" }, { status: 400 });
  const [trial, job] = await Promise.all([
    getStudyTrial(trialId),
    getBaselineJob(trialId),
  ]);
  if (!trial) return Response.json({ error: "Trial not found" }, { status: 404 });
  const result = job?.runId ? await getGenerationRunResult(job.runId) : null;
  return Response.json({ trial, job, result });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const trialId = typeof body.trialId === "string" ? body.trialId.trim() : "";
    if (!trialId) return Response.json({ error: "trialId is required" }, { status: 400 });
    const trial = await getStudyTrial(trialId);
    if (!trial) return Response.json({ error: "Trial not found" }, { status: 404 });
    if (body.action === "fail") {
      const error = typeof body.error === "string" ? body.error : "Baseline generation failed";
      await failBaselineJob(trialId, error);
      return Response.json({ failed: true });
    }
    const startAfterViewing = body.action === "start_after_viewing";
    const claimed = await claimBaselineJob(trialId, {
      checkpoint: startAfterViewing ? "artwork_viewed" : "evaluation_completed",
    });
    if (startAfterViewing && claimed.acquired) {
      const audio = await getAudioAnalysisForTrial(trialId);
      if (!audio?.musicProfile) {
        await failBaselineJob(trialId, "Audio analysis is unavailable for baseline generation");
        return Response.json({ error: "Audio analysis is unavailable" }, { status: 409 });
      }
      await insertInteractionEvent({
        trialId,
        sessionId: trial.sessionId,
        eventType: "artwork-evaluation-started",
        page: "/result",
        payload: { trialId, condition: trial.condition, period: trial.period },
      });
      const origin = request.nextUrl.origin;
      after(async () => {
        try {
          const response = await fetch(`${origin}/api/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              trialId,
              baselineLease: claimed.job.startedAt,
              generationRole: "direct_baseline",
              condition: trial.condition,
              sessionId: trial.sessionId,
              musicProfile: audio.musicProfile,
              musicAnalysis: audio.compatibilityAnalysis || {},
              presets: {},
            }),
          });
          if (!response.ok) {
            const data = await response.json().catch(() => ({})) as Record<string, unknown>;
            throw new Error(String(data.detail || data.error || "Baseline generation failed"));
          }
        } catch (error) {
          await failBaselineJob(
            trialId,
            error instanceof Error ? error.message : String(error)
          ).catch(() => undefined);
        }
      });
    }
    return Response.json({ trial, ...claimed }, { status: claimed.acquired ? 201 : 200 });
  } catch (error) {
    if (error instanceof BaselineNotEligibleError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    console.error("Baseline claim failed:", error);
    return Response.json({ error: "Baseline claim failed" }, { status: 500 });
  }
}
