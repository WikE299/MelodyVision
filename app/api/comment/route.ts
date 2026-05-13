import { NextRequest } from "next/server";
import { getCharacterById } from "@/lib/characters";
import { buildCommentPrompt, formatMusicContext } from "@/lib/prompts/system";
import { callLLM } from "@/lib/llm";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { characterId, musicAnalysis, userNote } = body;

    if (!characterId) {
      return Response.json({ error: "characterId required" }, { status: 400 });
    }

    const character = getCharacterById(characterId);
    if (!character) {
      return Response.json({ error: "Character not found" }, { status: 404 });
    }

    const musicContext = formatMusicContext(musicAnalysis);
    const systemPrompt = buildCommentPrompt(character, musicContext, userNote);

    const response = await callLLM({
      systemPrompt,
      userMessage: "请评论这首音乐。",
      temperature: character.temperature,
      maxTokens: 200,
    });

    return Response.json({
      characterId,
      characterName: character.name,
      comment: response.content,
      model: response.model,
    });
  } catch {
    return Response.json({ error: "Comment generation failed" }, { status: 500 });
  }
}
