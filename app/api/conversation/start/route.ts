import type { NextRequest } from "next/server";
import { getCharacterById } from "@/lib/characters";
import { runFacilitatorAgent } from "@/lib/agents/facilitator";
import { getMusicianAgentProfile } from "@/lib/agents/musicians";
import {
  createConversationState,
  createReflectivePlan,
  scheduleMusicianTurn,
  startReflectiveListening,
} from "@/lib/conversation";
import { insertConversationSnapshot } from "@/lib/db/research-data";
import { isInteractiveCondition } from "@/lib/contracts";
import { SINGLE_GUIDE_ID } from "@/lib/agents/single-guide";
import { getStudyTrial, updateStudyTrial } from "@/lib/db/study-trials";

function readStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string")
      .map(([key, text]) => [key, text.trim().slice(0, 800)])
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
    const trialId = typeof body.trialId === "string" ? body.trialId.trim() : sessionId;
    const musicProfileId = typeof body.musicProfileId === "string" ? body.musicProfileId.trim() : "";
    const condition = isInteractiveCondition(body.condition) ? body.condition : "multi_agent";
    const selectedMusicianIds: string[] = Array.isArray(body.selectedMusicianIds)
      ? body.selectedMusicianIds.filter((id: unknown): id is string => typeof id === "string")
      : [];

    if (!sessionId || !musicProfileId) {
      return Response.json({ error: "sessionId and musicProfileId are required" }, { status: 400 });
    }
    const studyTrial = trialId !== sessionId ? await getStudyTrial(trialId) : null;
    if (
      studyTrial && (
        studyTrial.sessionId !== sessionId ||
        studyTrial.musicProfileId !== musicProfileId ||
        studyTrial.condition !== condition
      )
    ) {
      return Response.json({ error: "Trial context does not match the conversation" }, { status: 409 });
    }
    if (
      selectedMusicianIds.length < 1 ||
      selectedMusicianIds.length > 4 ||
      new Set(selectedMusicianIds).size !== selectedMusicianIds.length ||
      selectedMusicianIds.some((id) => !getCharacterById(id))
    ) {
      return Response.json({ error: "selectedMusicianIds must contain 1-4 known unique musicians" }, { status: 400 });
    }

    const musicianNames = Object.fromEntries(
      selectedMusicianIds.map((id) => [id, getCharacterById(id)!.name])
    );
    const musicianIdentityContexts = Object.fromEntries(
      selectedMusicianIds.map((id) => [id, getMusicianAgentProfile(id)?.identityContext || ""])
    );
    const state = createConversationState({
      trialId,
      sessionId,
      musicProfileId,
      selectedMusicianIds,
      condition,
      turnPolicy: {
        userMayGenerateEarly:
          condition === "multi_agent" && studyTrial?.assignmentMethod !== "balanced_random",
      },
      ...(condition === "single_agent" ? { guideId: SINGLE_GUIDE_ID } : {}),
    });
    if (condition === "single_agent") {
      const nextState = startReflectiveListening(state);
      const facilitatorPlan = createReflectivePlan(nextState);
      await insertConversationSnapshot(nextState, "conversation-started").catch((error) => {
        console.error("Conversation start snapshot failed:", error);
      });
      if (studyTrial) await updateStudyTrial({ id: trialId, status: "interacting" });
      return Response.json({ state: nextState, facilitatorPlan });
    }
    const plan = await runFacilitatorAgent({
      state,
      musicianNames,
      musicianIdentityContexts,
      preparedSummaries: readStringRecord(body.preparedSummaries),
    });

    const nextState = scheduleMusicianTurn(state, plan);
    await insertConversationSnapshot(nextState, "conversation-started").catch((error) => {
      console.error("Conversation start snapshot failed:", error);
    });
    if (studyTrial) await updateStudyTrial({ id: trialId, status: "interacting" });
    return Response.json({
      state: nextState,
      facilitatorPlan: plan,
    });
  } catch (error) {
    console.error("Conversation start API error:", error);
    return Response.json(
      { error: "Conversation initialization failed", detail: String(error) },
      { status: 500 }
    );
  }
}
