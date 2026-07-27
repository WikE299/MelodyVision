import type { NextRequest } from "next/server";
import { getCharacterById } from "@/lib/characters";
import { runFacilitatorAgent } from "@/lib/agents/facilitator";
import { getMusicianAgentProfile } from "@/lib/agents/musicians";
import { runVisualScribeAgent } from "@/lib/agents/visual-scribe";
import {
  canConvergeFromUserEvidence,
  continueReflectiveListening,
  createReflectivePlan,
  parseConversationState,
  recordUserMessage,
  requestGeneration,
  scheduleMusicianTurn,
} from "@/lib/conversation";
import { insertConversationSnapshot, insertVisualBriefVersion } from "@/lib/db/research-data";
import { formatMusicContext } from "@/lib/prompts/system";
import { parseVisualBrief } from "@/lib/visual-brief";
import { isMeaningfulUserInput } from "@/lib/conversation/user-input";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const state = parseConversationState(body.conversationState);
    const content = typeof body.content === "string" ? body.content.trim().slice(0, 1000) : "";
    if (!content) {
      return Response.json({ error: "User message is required" }, { status: 400 });
    }
    if (!isMeaningfulUserInput(content)) {
      return Response.json({ error: "Please add a little of your own image before sending" }, { status: 400 });
    }
    if (state.condition === "multi_agent" && state.selectedMusicianIds.some((id) => !getCharacterById(id))) {
      return Response.json({ error: "Conversation contains an unknown musician" }, { status: 400 });
    }

    const afterUser = recordUserMessage(state, content);
    const previousBrief = parseVisualBrief(body.visualBrief);
    const visualBriefResult = await runVisualScribeAgent({
      conversationState: afterUser,
      previousBrief,
      musicContext: formatMusicContext(body.musicAnalysis || {}),
    });
    const briefCanConverge =
      afterUser.completedUserRounds >= 1 &&
      visualBriefResult.brief.readiness.ready &&
      afterUser.status !== "ready-to-generate";
    const stateWithBrief = {
      ...afterUser,
      ...(briefCanConverge ? { phase: "convergence" as const } : {}),
      visualBriefRef: {
        id: visualBriefResult.brief.id,
        version: visualBriefResult.brief.version,
      },
    };
    await insertVisualBriefVersion({
      trialId: state.trialId,
      sessionId: state.sessionId,
      brief: visualBriefResult.brief,
      meta: {
        model: visualBriefResult.model,
        attempts: visualBriefResult.attempts,
        profileVersion: visualBriefResult.profileVersion,
        fallback: visualBriefResult.fallback,
        validationErrors: visualBriefResult.validationErrors,
      },
    }).catch((error) => {
      console.error("Immediate VisualBrief persistence failed:", error);
    });
    if (afterUser.status === "ready-to-generate") {
      await insertConversationSnapshot(stateWithBrief, "user-message-ready").catch((error) => {
        console.error("User message snapshot failed:", error);
      });
      return Response.json({
        state: stateWithBrief,
        facilitatorPlan: null,
        visualBrief: visualBriefResult.brief,
      });
    }

    if (state.condition === "single_agent") {
      const nextState = continueReflectiveListening(
        stateWithBrief,
        undefined,
        visualBriefResult.brief.readiness.ready
      );
      const facilitatorPlan = createReflectivePlan(nextState, visualBriefResult.brief);
      await insertConversationSnapshot(nextState, "user-message-scheduled").catch((error) => {
        console.error("User message snapshot failed:", error);
      });
      return Response.json({
        state: nextState,
        facilitatorPlan,
        visualBrief: visualBriefResult.brief,
      });
    }

    const canConvergeNow = canConvergeFromUserEvidence(
      stateWithBrief,
      visualBriefResult.brief.readiness.ready
    );
    if (canConvergeNow) {
      const nextState = requestGeneration(stateWithBrief);
      await insertConversationSnapshot(nextState, "user-message-converged").catch((error) => {
        console.error("Converged user message snapshot failed:", error);
      });
      return Response.json({
        state: nextState,
        facilitatorPlan: null,
        visualBrief: visualBriefResult.brief,
      });
    }

    const musicianNames = Object.fromEntries(
      state.selectedMusicianIds.map((id) => [id, getCharacterById(id)!.name])
    );
    const preparedSummaries = Object.fromEntries(
      stateWithBrief.messages
        .filter((message) => message.role === "musician")
        .map((message) => [message.speakerId, message.content])
    );
    const plan = await runFacilitatorAgent({
      state: stateWithBrief,
      musicianNames,
      musicianIdentityContexts: Object.fromEntries(
        state.selectedMusicianIds.map((id) => [id, getMusicianAgentProfile(id)?.identityContext || ""])
      ),
      preparedSummaries,
      visualBrief: visualBriefResult.brief,
    });
    const nextState = scheduleMusicianTurn(stateWithBrief, plan);
    await insertConversationSnapshot(nextState, "user-message-scheduled").catch((error) => {
      console.error("User message snapshot failed:", error);
    });
    return Response.json({
      state: nextState,
      facilitatorPlan: plan,
      visualBrief: visualBriefResult.brief,
    });
  } catch (error) {
    return Response.json(
      { error: "Conversation response failed", detail: String(error) },
      { status: 400 }
    );
  }
}
