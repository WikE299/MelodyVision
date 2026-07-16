import type { NextRequest } from "next/server";
import { getStudyTrial } from "@/lib/db/study-trials";
import {
  getTrialEvaluationState,
  saveArtworkEvaluation,
  savePairwiseComparison,
  type ComparisonChoice,
} from "@/lib/db/trial-evaluations";

export const runtime = "nodejs";

function score(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 5 ? parsed : null;
}

function choice(value: unknown): ComparisonChoice | null {
  return value === "co_created" || value === "direct_baseline" || value === "tie"
    ? value
    : null;
}

export async function GET(request: NextRequest) {
  const trialId = request.nextUrl.searchParams.get("trialId")?.trim() || "";
  if (!trialId) return Response.json({ error: "trialId is required" }, { status: 400 });
  const trial = await getStudyTrial(trialId);
  if (!trial) return Response.json({ error: "Trial not found" }, { status: 404 });
  return Response.json({ trial, ...(await getTrialEvaluationState(trialId)) });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const trialId = typeof body.trialId === "string" ? body.trialId.trim() : "";
    const trial = trialId ? await getStudyTrial(trialId) : null;
    if (!trial) return Response.json({ error: "Trial not found" }, { status: 404 });

    if (body.stage === "artwork") {
      const scores = [
        score(body.musicMatchScore),
        score(body.imaginationMatchScore),
        score(body.agencyScore),
        score(body.ownershipScore),
      ];
      if (scores.some((value) => value === null) || !trial.coCreatedRunId) {
        return Response.json({ error: "All artwork scores and a co-created run are required" }, { status: 400 });
      }
      await saveArtworkEvaluation({
        trialId,
        runId: trial.coCreatedRunId,
        musicMatchScore: scores[0]!,
        imaginationMatchScore: scores[1]!,
        agencyScore: scores[2]!,
        ownershipScore: scores[3]!,
      });
      return Response.json({ saved: true, stage: "artwork" });
    }

    if (body.stage === "comparison") {
      const musicMatchChoice = choice(body.musicMatchChoice);
      const aestheticChoice = choice(body.aestheticChoice);
      const overallChoice = choice(body.overallChoice);
      if (!musicMatchChoice || !aestheticChoice || !overallChoice || !trial.baselineRunId || !trial.coCreatedRunId) {
        return Response.json({ error: "A complete paired comparison is required" }, { status: 400 });
      }
      await savePairwiseComparison({
        trialId,
        leftRole: trial.comparisonOrder === "co_created_left" ? "co_created" : "direct_baseline",
        musicMatchChoice,
        aestheticChoice,
        overallChoice,
        reason: typeof body.reason === "string" ? body.reason.trim().slice(0, 2000) : "",
      });
      return Response.json({ saved: true, stage: "comparison", revealed: true });
    }

    return Response.json({ error: "Unknown evaluation stage" }, { status: 400 });
  } catch (error) {
    console.error("Trial evaluation failed:", error);
    return Response.json({ error: "Trial evaluation failed" }, { status: 500 });
  }
}
