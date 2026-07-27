import type { NextRequest } from "next/server";
import { getCharacterById } from "@/lib/characters";
import {
  createConversationState,
  createReflectivePlan,
  startUserFirstConversation,
} from "@/lib/conversation";
import { insertConversationSnapshot } from "@/lib/db/research-data";
import { isInteractiveCondition } from "@/lib/contracts";
import { SINGLE_GUIDE_ID } from "@/lib/agents/single-guide";
import { getStudyTrial, updateStudyTrial } from "@/lib/db/study-trials";

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

    const state = createConversationState({
      trialId,
      sessionId,
      musicProfileId,
      selectedMusicianIds,
      condition,
      turnPolicy: {
        maxUserRounds: condition === "multi_agent" ? 4 : 2,
        userMayInterrupt: condition !== "multi_agent",
        userMayGenerateEarly: condition === "multi_agent",
      },
      ...(condition === "single_agent" ? { guideId: SINGLE_GUIDE_ID } : {}),
    });
    const nextState = startUserFirstConversation(state);
    const facilitatorPlan = createReflectivePlan(nextState);
    await insertConversationSnapshot(nextState, "conversation-started").catch((error) => {
      console.error("Conversation start snapshot failed:", error);
    });
    if (studyTrial) await updateStudyTrial({ id: trialId, status: "interacting" });
    return Response.json({
      state: nextState,
      facilitatorPlan,
    });
  } catch (error) {
    console.error("Conversation start API error:", error);
    return Response.json(
      { error: "Conversation initialization failed", detail: String(error) },
      { status: 500 }
    );
  }
}
