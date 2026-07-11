import type { NextRequest } from "next/server";
import { runVisualScribeAgent } from "@/lib/agents/visual-scribe";
import { parseConversationState } from "@/lib/conversation";
import { formatMusicContext } from "@/lib/prompts/system";
import { parseVisualBrief } from "@/lib/visual-brief";
import { insertVisualBriefVersion } from "@/lib/db/research-data";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const state = parseConversationState(body.conversationState);
    if (state.turnOwner !== "user" || !["awaiting-user", "ready-to-generate"].includes(state.status)) {
      return Response.json({ error: "VisualBrief can only update after a completed round" }, { status: 409 });
    }

    const previousBrief = parseVisualBrief(body.previousBrief);
    if (
      previousBrief && (
        previousBrief.conversationId !== state.id ||
        previousBrief.musicProfileId !== state.musicProfileId
      )
    ) {
      return Response.json({ error: "VisualBrief does not belong to this conversation" }, { status: 409 });
    }
    if (
      state.visualBriefRef && (
        !previousBrief ||
        previousBrief.id !== state.visualBriefRef.id ||
        previousBrief.version !== state.visualBriefRef.version
      )
    ) {
      return Response.json({ error: "VisualBrief version is stale" }, { status: 409 });
    }

    const result = await runVisualScribeAgent({
      conversationState: state,
      previousBrief,
      musicContext: formatMusicContext(body.musicAnalysis || {}),
    });
    const meta = {
      model: result.model,
      attempts: result.attempts,
      profileVersion: result.profileVersion,
      fallback: result.fallback,
      validationErrors: result.validationErrors,
    };
    await insertVisualBriefVersion({ sessionId: state.sessionId, brief: result.brief, meta }).catch((error) => {
      console.error("VisualBrief persistence failed:", error);
    });

    return Response.json({
      visualBrief: result.brief,
      visualBriefRef: {
        id: result.brief.id,
        version: result.brief.version,
      },
      meta,
    });
  } catch (error) {
    return Response.json(
      { error: "VisualBrief update failed", detail: String(error) },
      { status: 400 }
    );
  }
}
