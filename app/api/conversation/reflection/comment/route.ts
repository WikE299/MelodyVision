import type { NextRequest } from "next/server";
import { getCharacterById } from "@/lib/characters";
import {
  getMusicianAgentProfile,
  runMusicianAgent,
} from "@/lib/agents/musicians";
import {
  parseConversationState,
  recordReflectiveComment,
} from "@/lib/conversation";
import { insertConversationSnapshot } from "@/lib/db/research-data";
import { formatMusicContext } from "@/lib/prompts/system";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const state = parseConversationState(body.conversationState);
    const speakerId = typeof body.speakerId === "string" ? body.speakerId.trim() : "";
    if (
      state.condition !== "single_agent" ||
      !state.selectedMusicianIds.includes(speakerId) ||
      !getCharacterById(speakerId)
    ) {
      return Response.json({ error: "Musician is not part of this reflective session" }, { status: 400 });
    }

    const existing = state.messages.find(
      (message) => message.role === "musician" && message.speakerId === speakerId
    );
    if (existing) {
      return Response.json({ state, comment: existing.content, cached: true });
    }

    const profile = getMusicianAgentProfile(speakerId);
    if (!profile) {
      return Response.json({ error: "Musician agent not found" }, { status: 404 });
    }
    const result = await runMusicianAgent({
      profile,
      musicContext: formatMusicContext(body.musicAnalysis || {}),
    });
    const nextState = recordReflectiveComment(state, {
      speakerId,
      content: result.comment,
    });
    await insertConversationSnapshot(nextState, "reflective-comment-completed").catch((error) => {
      console.error("Reflective comment snapshot failed:", error);
    });
    return Response.json({
      state: nextState,
      comment: result.comment,
      model: result.model,
      profileVersion: result.profileVersion,
    });
  } catch (error) {
    console.error("Reflective comment API error:", error);
    return Response.json(
      { error: "Reflective comment generation failed", detail: String(error) },
      { status: 500 }
    );
  }
}
