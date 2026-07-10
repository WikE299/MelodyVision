import { NextRequest } from "next/server";
import {
  getMusicianAgentProfile,
  runMusicianAgent,
} from "@/lib/agents/musicians";
import { formatMusicContext } from "@/lib/prompts/system";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { characterId, musicAnalysis, userNote } = body;

    if (!characterId) {
      return Response.json({ error: "characterId required" }, { status: 400 });
    }

    const profile = getMusicianAgentProfile(characterId);
    if (!profile) {
      return Response.json({ error: "Musician agent not found" }, { status: 404 });
    }

    const musicContext = formatMusicContext(musicAnalysis || {});
    const response = await runMusicianAgent({
      profile,
      musicContext,
      userNote: typeof userNote === "string" ? userNote.slice(0, 1000) : undefined,
    });

    return Response.json({
      characterId,
      characterName: profile.displayName,
      comment: response.comment,
      model: response.model,
      agentProfileVersion: response.profileVersion,
      attempts: response.attempts,
      usage: response.usage,
    });
  } catch (err) {
    console.error("Comment API error:", err);
    return Response.json({ error: "Comment generation failed", detail: String(err) }, { status: 500 });
  }
}
