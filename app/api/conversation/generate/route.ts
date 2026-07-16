import type { NextRequest } from "next/server";
import { parseConversationState, requestGeneration } from "@/lib/conversation";
import { insertConversationSnapshot } from "@/lib/db/research-data";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const state = parseConversationState(body.conversationState);
    const nextState = requestGeneration(state);
    await insertConversationSnapshot(nextState, "generation-requested").catch((error) => {
      console.error("Generation request snapshot failed:", error);
    });
    return Response.json({ state: nextState });
  } catch (error) {
    return Response.json(
      { error: "Conversation cannot enter generation", detail: String(error) },
      { status: 400 }
    );
  }
}
