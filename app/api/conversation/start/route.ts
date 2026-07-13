import type { NextRequest } from "next/server";
import { getCharacterById } from "@/lib/characters";
import { runFacilitatorAgent } from "@/lib/agents/facilitator";
import { getMusicianAgentProfile } from "@/lib/agents/musicians";
import {
  createConversationState,
  scheduleMusicianTurn,
} from "@/lib/conversation";
import { insertConversationSnapshot } from "@/lib/db/research-data";

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
    const musicProfileId = typeof body.musicProfileId === "string" ? body.musicProfileId.trim() : "";
    const selectedMusicianIds: string[] = Array.isArray(body.selectedMusicianIds)
      ? body.selectedMusicianIds.filter((id: unknown): id is string => typeof id === "string")
      : [];

    if (!sessionId || !musicProfileId) {
      return Response.json({ error: "sessionId and musicProfileId are required" }, { status: 400 });
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
      sessionId,
      musicProfileId,
      selectedMusicianIds,
    });
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
