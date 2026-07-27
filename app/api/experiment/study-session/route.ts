import type { NextRequest } from "next/server";
import { audioCatalog, getAudioPlaybackUrl } from "@/lib/audio/catalog";
import { isSessionComparisonChoice } from "@/lib/contracts";
import { createRecoveryFacilitatorPlan } from "@/lib/conversation/recovery-plan";
import {
  createOrRecoverStudySession,
  getStudyPeriodAssignment,
  getStudySession,
  getStudySessionComparison,
  saveStudySessionComparison,
  updateStudySession,
} from "@/lib/db/study-sessions";
import { getGenerationRunResult } from "@/lib/db/generation-runs";
import {
  getAudioAnalysisForTrial,
  getConversationRecoveryForTrial,
} from "@/lib/db/research-data";
import { getBaselineJob, listStudyTrialsBySession } from "@/lib/db/study-trials";

export const runtime = "nodejs";

const DEFAULT_STIMULUS_X = "bach-cello-prelude";
const DEFAULT_STIMULUS_Y = "mozart-eine-kleine-nachtmusik";

function validStimulus(value: unknown, fallback: string): string {
  const requested = typeof value === "string" ? value.trim() : "";
  const item = audioCatalog.find((candidate) => candidate.id === requested);
  return item?.publicUseStatus === "cleared" ? item.id : fallback;
}

async function payloadForSession(id: string) {
  const session = await getStudySession(id);
  if (!session) return null;
  const trials = await listStudyTrialsBySession(session.id);
  const periodResults = await Promise.all(trials.map(async (trial) => {
    const stimulus = audioCatalog.find((item) => item.id === trial.stimulusId);
    const [baselineJob, audioAnalysis, conversation] = await Promise.all([
      getBaselineJob(trial.id),
      getAudioAnalysisForTrial(trial.id),
      getConversationRecoveryForTrial(trial.id),
    ]);
    return {
      trial,
      audioUrl: stimulus ? getAudioPlaybackUrl(stimulus) : "",
      musicName: stimulus?.name || trial.stimulusId,
      baselineJob,
      musicProfile: audioAnalysis?.musicProfile ?? null,
      compatibilityAnalysis: audioAnalysis?.compatibilityAnalysis ?? null,
      conversationState: conversation?.state ?? null,
      visualBrief: conversation?.visualBrief ?? null,
      facilitatorPlan: conversation
        ? createRecoveryFacilitatorPlan(conversation.state, conversation.visualBrief)
        : null,
      coCreated: trial.coCreatedRunId
        ? await getGenerationRunResult(trial.coCreatedRunId)
        : null,
      baseline: trial.baselineRunId
        ? await getGenerationRunResult(trial.baselineRunId)
        : null,
    };
  }));
  return {
    session,
    assignments: [
      getStudyPeriodAssignment(session, 1),
      getStudyPeriodAssignment(session, 2),
    ],
    trials,
    periodResults,
    comparison: await getStudySessionComparison(session.id),
  };
}

export async function GET(request: NextRequest) {
  const studySessionId = request.nextUrl.searchParams.get("studySessionId")?.trim() || "";
  if (!studySessionId) {
    return Response.json({ error: "studySessionId is required" }, { status: 400 });
  }
  const payload = await payloadForSession(studySessionId);
  return payload
    ? Response.json(payload)
    : Response.json({ error: "Study session not found" }, { status: 404 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "create";

    if (action === "create") {
      const participantId = typeof body.participantId === "string"
        ? body.participantId.trim().slice(0, 100)
        : "";
      const deviceSessionId = typeof body.deviceSessionId === "string"
        ? body.deviceSessionId.trim().slice(0, 100)
        : "";
      if (!participantId || !deviceSessionId) {
        return Response.json(
          { error: "participantId and deviceSessionId are required" },
          { status: 400 }
        );
      }
      const result = await createOrRecoverStudySession({
        participantId,
        deviceSessionId,
        stimulusXId: validStimulus(body.stimulusXId, DEFAULT_STIMULUS_X),
        stimulusYId: validStimulus(body.stimulusYId, DEFAULT_STIMULUS_Y),
      });
      const payload = await payloadForSession(result.session.id);
      if (!payload) {
        return Response.json({ error: "Study session was not persisted" }, { status: 500 });
      }
      return Response.json(
        { ...payload, recovered: result.recovered },
        { status: result.recovered ? 200 : 201 }
      );
    }

    const studySessionId = typeof body.studySessionId === "string"
      ? body.studySessionId.trim()
      : "";
    const session = studySessionId ? await getStudySession(studySessionId) : null;
    if (!session) {
      return Response.json({ error: "Study session not found" }, { status: 404 });
    }

    if (action === "select_musicians") {
      const selectedMusicianIds = Array.isArray(body.selectedMusicianIds)
        ? body.selectedMusicianIds
            .filter((value): value is string => typeof value === "string")
            .map((value) => value.trim())
            .filter(Boolean)
            .slice(0, 4)
        : [];
      if (selectedMusicianIds.length === 0) {
        return Response.json({ error: "At least one musician is required" }, { status: 400 });
      }
      if (
        session.selectedMusicianIds.length > 0 &&
        session.selectedMusicianIds.join("|") !== selectedMusicianIds.join("|")
      ) {
        return Response.json(
          { error: "The musician set is fixed for both study periods" },
          { status: 409 }
        );
      }
      await updateStudySession({ id: session.id, selectedMusicianIds });
      return Response.json(await payloadForSession(session.id));
    }

    if (action === "compare") {
      const expressionSupportChoice = isSessionComparisonChoice(body.expressionSupportChoice)
        ? body.expressionSupportChoice
        : null;
      const immersionChoice = isSessionComparisonChoice(body.immersionChoice)
        ? body.immersionChoice
        : null;
      const creativeFreedomChoice = isSessionComparisonChoice(body.creativeFreedomChoice)
        ? body.creativeFreedomChoice
        : null;
      const overallChoice = isSessionComparisonChoice(body.overallChoice)
        ? body.overallChoice
        : null;
      if (
        !expressionSupportChoice ||
        !immersionChoice ||
        !creativeFreedomChoice ||
        !overallChoice ||
        session.status !== "comparing"
      ) {
        return Response.json(
          { error: "Both study periods and all comparison responses are required" },
          { status: 400 }
        );
      }
      await saveStudySessionComparison({
        studySessionId: session.id,
        expressionSupportChoice,
        immersionChoice,
        creativeFreedomChoice,
        overallChoice,
        reason: typeof body.reason === "string" ? body.reason.trim().slice(0, 2000) : "",
      });
      return Response.json(await payloadForSession(session.id));
    }

    return Response.json({ error: "Unknown study session action" }, { status: 400 });
  } catch (error) {
    console.error("Study session request failed:", error);
    return Response.json({ error: "Study session request failed" }, { status: 500 });
  }
}
