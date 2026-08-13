import type { NextRequest } from "next/server";
import { getGenerationRunResult } from "@/lib/db/generation-runs";
import { insertInteractionEvent } from "@/lib/db/research-data";
import {
  getQuestionnaireResponse,
  listQuestionnaireResponses,
  upsertQuestionnaireResponse,
} from "@/lib/db/questionnaire-responses";
import {
  completeStudyPeriod,
  getStudySession,
  updateStudySession,
} from "@/lib/db/study-sessions";
import { listStudyTrialsBySession, updateStudyTrial } from "@/lib/db/study-trials";
import { getTrialEvaluationState } from "@/lib/db/trial-evaluations";
import {
  getQuestionnaireDefinition,
  QUESTIONNAIRE_VERSION,
  resolveStudyQuestionnaireProgress,
  scoreCsiWithWeights,
  scoreQuestionnaire,
  validateQuestionnaireAnswers,
  type QuestionnaireAnswers,
  type StudyQuestionnaireProgress,
} from "@/lib/questionnaires";

export const runtime = "nodejs";

async function progressForSession(studySessionId: string): Promise<{
  progress: StudyQuestionnaireProgress;
  participantId: string;
} | null> {
  const session = await getStudySession(studySessionId);
  if (!session) return null;
  const [trials, responses] = await Promise.all([
    listStudyTrialsBySession(studySessionId),
    listQuestionnaireResponses(studySessionId),
  ]);
  const evaluationStates = await Promise.all(
    trials.map(async (trial) => ({
      trialId: trial.id,
      state: await getTrialEvaluationState(trial.id),
    }))
  );
  const progress = resolveStudyQuestionnaireProgress({
    session,
    trials,
    responses,
    evaluatedTrialIds: evaluationStates
      .filter((item) => Boolean(item.state.artwork))
      .map((item) => item.trialId),
    comparedTrialIds: evaluationStates
      .filter((item) => Boolean(item.state.labeledComparison))
      .map((item) => item.trialId),
  });
  if (progress.nextStep?.runId) {
    const run = await getGenerationRunResult(progress.nextStep.runId);
    if (run?.imageUrl) progress.nextStep.imageUrl = run.imageUrl;
  }
  return { progress, participantId: session.participantId };
}

export async function GET(request: NextRequest) {
  const studySessionId = request.nextUrl.searchParams.get("studySessionId")?.trim() || "";
  if (!studySessionId) {
    return Response.json({ error: "studySessionId is required" }, { status: 400 });
  }
  const result = await progressForSession(studySessionId);
  return result
    ? Response.json(result)
    : Response.json({ error: "Study session not found" }, { status: 404 });
}

async function saveResponse(request: NextRequest, status: "draft" | "completed") {
  const body = await request.json() as Record<string, unknown>;
  const studySessionId = typeof body.studySessionId === "string"
    ? body.studySessionId.trim()
    : "";
  const responseKey = typeof body.responseKey === "string" ? body.responseKey.trim() : "";
  const answers = body.answers && typeof body.answers === "object" && !Array.isArray(body.answers)
    ? body.answers as QuestionnaireAnswers
    : null;
  if (!studySessionId || !responseKey || !answers) {
    return Response.json({ error: "Study session, response key, and answers are required" }, { status: 400 });
  }

  const current = await progressForSession(studySessionId);
  if (!current) return Response.json({ error: "Study session not found" }, { status: 404 });
  const step = current.progress.nextStep;
  if (current.progress.nextAction !== "questionnaire" || !step || step.key !== responseKey) {
    const existing = await getQuestionnaireResponse(studySessionId, responseKey);
    if (existing?.status === "completed") {
      return Response.json({ saved: true, response: existing, ...current });
    }
    return Response.json({ error: "This questionnaire is not the current study step" }, { status: 409 });
  }

  const definition = getQuestionnaireDefinition(step.instrument, "zh");
  const validation = validateQuestionnaireAnswers(definition, answers);
  if (status === "completed" && !validation.valid) {
    return Response.json({ error: "Questionnaire answers are incomplete", validation }, { status: 400 });
  }
  const scored = status === "completed"
    ? scoreQuestionnaire(step.instrument, answers)
    : { total: null, metrics: {} };
  const response = await upsertQuestionnaireResponse({
    responseKey: step.key,
    participantId: current.participantId,
    studySessionId,
    trialId: step.trialId,
    runId: step.runId,
    period: step.period,
    condition: step.condition,
    generationRole: step.generationRole,
    instrument: step.instrument,
    questionnaireVersion: QUESTIONNAIRE_VERSION,
    scope: step.scope,
    status,
    answers,
    totalScore: scored.total,
    metrics: scored.metrics,
  });

  if (status === "completed" && step.instrument === "csi_weighting") {
    const completedResponses = await listQuestionnaireResponses(studySessionId);
    await Promise.all(completedResponses
      .filter((item) => item.instrument === "csi" && item.status === "completed")
      .map(async (item) => {
        const weighted = scoreCsiWithWeights(item.answers, answers);
        if (!weighted.complete) return;
        await upsertQuestionnaireResponse({
          responseKey: item.responseKey,
          participantId: item.participantId,
          studySessionId: item.studySessionId,
          trialId: item.trialId,
          runId: item.runId,
          period: item.period,
          condition: item.condition,
          generationRole: item.generationRole,
          instrument: item.instrument,
          questionnaireVersion: item.questionnaireVersion,
          scope: item.scope,
          status: "completed",
          answers: item.answers,
          totalScore: weighted.total,
          metrics: weighted.metrics,
        });
      }));
  }

  if (status === "completed" && step.instrument === "manipulation_check" && step.period) {
    await completeStudyPeriod({ studySessionId, period: step.period });
  }

  if (status === "completed") {
    const eventSessionId = step.trialId
      ? (await listStudyTrialsBySession(studySessionId)).find((trial) => trial.id === step.trialId)?.sessionId
      : (await getStudySession(studySessionId))?.deviceSessionId;
    if (eventSessionId) {
      try {
        await insertInteractionEvent({
          trialId: step.trialId || "",
          sessionId: eventSessionId,
          eventType: "questionnaire-section-completed",
          page: "/study/questionnaire",
          payload: {
            studySessionId,
            responseKey: step.key,
            instrument: step.instrument,
            period: step.period,
            condition: step.condition,
            generationRole: step.generationRole,
            questionnaireVersion: QUESTIONNAIRE_VERSION,
          },
        });
      } catch (eventError) {
        console.warn("Questionnaire completion event was not recorded:", eventError);
      }
    }
  }

  let updated = await progressForSession(studySessionId);
  if (updated?.progress.nextAction === "complete") {
    const trials = await listStudyTrialsBySession(studySessionId);
    await Promise.all(trials.map((trial) => updateStudyTrial({
      id: trial.id,
      status: "completed",
    })));
    await updateStudySession({ id: studySessionId, status: "completed", completed: true });
    updated = await progressForSession(studySessionId);
  }
  return Response.json({ saved: true, response, ...updated });
}

export async function PUT(request: NextRequest) {
  try {
    return await saveResponse(request, "draft");
  } catch (error) {
    console.error("Questionnaire draft save failed:", error);
    return Response.json({ error: "Questionnaire draft save failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    return await saveResponse(request, "completed");
  } catch (error) {
    console.error("Questionnaire submission failed:", error);
    return Response.json({ error: "Questionnaire submission failed" }, { status: 500 });
  }
}
