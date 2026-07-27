import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { isInteractiveCondition } from "@/lib/contracts";
import { attachAudioAnalysisToTrial } from "@/lib/db/research-data";
import {
  attachTrialToStudySession,
  getStudyPeriodAssignment,
  getStudySession,
} from "@/lib/db/study-sessions";
import {
  createBalancedStudyTrial,
  createStudyTrial,
  getStudyTrial,
  getStudyTrialBySessionPeriod,
  recoverStudyTrial,
} from "@/lib/db/study-trials";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const trialId = request.nextUrl.searchParams.get("trialId")?.trim() || "";
  if (!trialId) return Response.json({ error: "trialId is required" }, { status: 400 });
  const trial = await getStudyTrial(trialId);
  if (!trial) return Response.json({ error: "Trial not found" }, { status: 404 });
  return Response.json({ trial });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    if (body.action === "recover") {
      const staleTrialId = typeof body.staleTrialId === "string"
        ? body.staleTrialId.trim().slice(0, 100)
        : "";
      const assignmentMethod = body.assignmentMethod === "crossover_block"
        ? "crossover_block"
        : body.assignmentMethod === "balanced_random"
        ? "balanced_random"
        : body.assignmentMethod === "demo_choice"
          ? "demo_choice"
          : null;
      const condition = isInteractiveCondition(body.condition) ? body.condition : null;
      const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim().slice(0, 100) : "";
      const participantId = typeof body.participantId === "string"
        ? body.participantId.trim().slice(0, 100)
        : "";
      const musicProfileId = typeof body.musicProfileId === "string"
        ? body.musicProfileId.trim().slice(0, 160)
        : "";
      if (!staleTrialId || !assignmentMethod || !condition || !sessionId || !musicProfileId) {
        return Response.json({ error: "Complete stale trial metadata is required" }, { status: 400 });
      }

      const result = await recoverStudyTrial({
        id: staleTrialId,
        participantId: participantId || `anonymous-${randomUUID()}`,
        sessionId,
        condition,
        assignmentMethod,
        musicProfileId,
        studySessionId: typeof body.studySessionId === "string" ? body.studySessionId.trim() : undefined,
        period: body.period === 1 || body.period === 2 ? body.period : undefined,
        stimulusId: typeof body.stimulusId === "string" ? body.stimulusId.trim() : undefined,
      });
      await attachAudioAnalysisToTrial({ sessionId, trialId: result.trial.id, musicProfileId });
      return Response.json(result, { status: result.recovered ? 201 : 200 });
    }

    const mode = body.mode === "study" ? "study" : "demo";
    const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim().slice(0, 100) : "";
    const participantId = typeof body.participantId === "string"
      ? body.participantId.trim().slice(0, 100)
      : "";
    const musicProfileId = typeof body.musicProfileId === "string"
      ? body.musicProfileId.trim().slice(0, 160)
      : "";
    if (!sessionId || !musicProfileId) {
      return Response.json({ error: "sessionId and musicProfileId are required" }, { status: 400 });
    }

    const requestedCondition = isInteractiveCondition(body.requestedCondition)
      ? body.requestedCondition
      : null;
    if (mode === "demo" && !requestedCondition) {
      return Response.json({ error: "Demo trials require a valid requestedCondition" }, { status: 400 });
    }

    if (mode === "study" && typeof body.studySessionId === "string") {
      const studySession = await getStudySession(body.studySessionId.trim());
      const period = body.period === 1 || body.period === 2 ? body.period : null;
      if (!studySession || !period) {
        return Response.json({ error: "A valid study session and period are required" }, { status: 400 });
      }
      const assignment = getStudyPeriodAssignment(studySession, period);
      if (
        (period === 1 && studySession.currentPeriod !== 1) ||
        (period === 2 && studySession.currentPeriod !== 2) ||
        (typeof body.stimulusId === "string" && body.stimulusId !== assignment.stimulusId)
      ) {
        return Response.json({ error: "Study period assignment does not match the session" }, { status: 409 });
      }
      const existing = await getStudyTrialBySessionPeriod(studySession.id, period);
      if (existing) {
        await attachAudioAnalysisToTrial({
          sessionId,
          trialId: existing.id,
          musicProfileId: existing.musicProfileId,
        });
        return Response.json({ trial: existing, recovered: true }, { status: 200 });
      }
      const trial = await createStudyTrial({
        participantId: studySession.participantId,
        sessionId,
        studySessionId: studySession.id,
        period,
        stimulusId: assignment.stimulusId,
        condition: assignment.condition,
        assignmentMethod: "crossover_block",
        musicProfileId,
      });
      await attachTrialToStudySession({
        studySessionId: studySession.id,
        period,
        trialId: trial.id,
      });
      await attachAudioAnalysisToTrial({ sessionId, trialId: trial.id, musicProfileId });
      return Response.json({ trial }, { status: 201 });
    }

    const identity = participantId || `anonymous-${randomUUID()}`;
    const trial = mode === "study"
      ? await createBalancedStudyTrial({
          participantId: identity,
          sessionId,
          musicProfileId,
        })
      : await createStudyTrial({
          participantId: identity,
          sessionId,
          condition: requestedCondition!,
          assignmentMethod: "demo_choice",
          musicProfileId,
        });
    await attachAudioAnalysisToTrial({ sessionId, trialId: trial.id, musicProfileId });
    return Response.json({ trial }, { status: 201 });
  } catch (error) {
    console.error("Study trial creation failed:", error);
    return Response.json({ error: "Study trial creation failed" }, { status: 500 });
  }
}
