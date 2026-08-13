import type { NextRequest } from "next/server";
import {
  getStudyTrial,
  listStudyTrialsBySession,
  updateStudyTrial,
} from "@/lib/db/study-trials";
import {
  completeStudyPeriod,
  getStudySession,
  getStudySessionComparison,
  updateStudySession,
} from "@/lib/db/study-sessions";
import { usesIntegratedQuestionnaires } from "@/lib/contracts";
import {
  getTrialEvaluationState,
  saveArtworkEvaluation,
  saveLabeledComparison,
  saveManipulationCheck,
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
        score(body.immersionScore),
        score(body.satisfactionScore),
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
        immersionScore: scores[4]!,
        satisfactionScore: scores[5]!,
      });
      return Response.json({ saved: true, stage: "artwork" });
    }

    if (body.stage === "comparison") {
      const musicMatchChoice = choice(body.musicMatchChoice);
      const imaginationMatchChoice = choice(body.imaginationMatchChoice);
      const overallChoice = choice(body.overallChoice);
      if (!musicMatchChoice || !imaginationMatchChoice || !overallChoice || !trial.baselineRunId || !trial.coCreatedRunId) {
        return Response.json({ error: "A complete labeled comparison is required" }, { status: 400 });
      }
      if (trial.studySessionId) {
        const [session, sessionComparison] = await Promise.all([
          getStudySession(trial.studySessionId),
          getStudySessionComparison(trial.studySessionId),
        ]);
        if (
          !usesIntegratedQuestionnaires(trial.protocolVersion) &&
          (session?.status !== "baseline_review" || !sessionComparison)
        ) {
          return Response.json(
            { error: "The cross-experience comparison must be completed first" },
            { status: 409 }
          );
        }
      }
      await saveLabeledComparison({
        trialId,
        musicMatchChoice,
        imaginationMatchChoice,
        overallChoice,
        reason: typeof body.reason === "string" ? body.reason.trim().slice(0, 2000) : "",
      });
      if (trial.studySessionId) {
        if (usesIntegratedQuestionnaires(trial.protocolVersion)) {
          return Response.json({ saved: true, stage: "comparison" });
        }
        await updateStudyTrial({ id: trial.id, status: "completed" });
        const pairedTrials = await listStudyTrialsBySession(trial.studySessionId);
        const pairedStates = await Promise.all(
          pairedTrials.map((item) => getTrialEvaluationState(item.id))
        );
        if (
          pairedTrials.length === 2 &&
          pairedStates.every((state) =>
            Boolean(
              state.artwork &&
              state.manipulation &&
              state.labeledComparison
            )
          )
        ) {
          await updateStudySession({
            id: trial.studySessionId,
            status: "completed",
            completed: true,
          });
        }
      }
      return Response.json({ saved: true, stage: "comparison" });
    }

    if (body.stage === "manipulation") {
      const scores = [
        score(body.perspectiveMultiplicityScore),
        score(body.articulationSupportScore),
        score(body.dialogueExperienceScore),
      ];
      if (scores.some((value) => value === null)) {
        return Response.json({ error: "All interaction check scores are required" }, { status: 400 });
      }
      const evaluationState = await getTrialEvaluationState(trialId);
      if (!evaluationState.artwork) {
        return Response.json(
          { error: "The artwork evaluation must be completed first" },
          { status: 409 }
        );
      }
      await saveManipulationCheck({
        trialId,
        perspectiveMultiplicityScore: scores[0]!,
        articulationSupportScore: scores[1]!,
        dialogueExperienceScore: scores[2]!,
      });
      if (trial.studySessionId && trial.period) {
        await completeStudyPeriod({
          studySessionId: trial.studySessionId,
          period: trial.period,
        });
      }
      return Response.json({ saved: true, stage: "manipulation" });
    }

    return Response.json({ error: "Unknown evaluation stage" }, { status: 400 });
  } catch (error) {
    console.error("Trial evaluation failed:", error);
    return Response.json({ error: "Trial evaluation failed" }, { status: 500 });
  }
}
