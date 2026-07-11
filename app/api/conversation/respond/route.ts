import type { NextRequest } from "next/server";
import { getCharacterById } from "@/lib/characters";
import { runFacilitatorAgent } from "@/lib/agents/facilitator";
import {
  parseConversationState,
  recordUserMessage,
  scheduleMusicianTurn,
} from "@/lib/conversation";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const state = parseConversationState(body.conversationState);
    const content = typeof body.content === "string" ? body.content.trim().slice(0, 1000) : "";
    if (!content) {
      return Response.json({ error: "User message is required" }, { status: 400 });
    }
    if (state.selectedMusicianIds.some((id) => !getCharacterById(id))) {
      return Response.json({ error: "Conversation contains an unknown musician" }, { status: 400 });
    }

    const afterUser = recordUserMessage(state, content);
    if (afterUser.status === "ready-to-generate") {
      return Response.json({ state: afterUser, facilitatorPlan: null });
    }

    const musicianNames = Object.fromEntries(
      state.selectedMusicianIds.map((id) => [id, getCharacterById(id)!.name])
    );
    const preparedSummaries = Object.fromEntries(
      afterUser.messages
        .filter((message) => message.role === "musician")
        .map((message) => [message.speakerId, message.content])
    );
    const plan = await runFacilitatorAgent({
      state: afterUser,
      musicianNames,
      preparedSummaries,
    });
    return Response.json({
      state: scheduleMusicianTurn(afterUser, plan),
      facilitatorPlan: plan,
    });
  } catch (error) {
    return Response.json(
      { error: "Conversation response failed", detail: String(error) },
      { status: 400 }
    );
  }
}
