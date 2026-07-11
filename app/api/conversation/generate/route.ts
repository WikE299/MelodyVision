import type { NextRequest } from "next/server";
import { parseConversationState, requestGeneration } from "@/lib/conversation";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const state = parseConversationState(body.conversationState);
    return Response.json({ state: requestGeneration(state) });
  } catch (error) {
    return Response.json(
      { error: "Conversation cannot enter generation", detail: String(error) },
      { status: 400 }
    );
  }
}
