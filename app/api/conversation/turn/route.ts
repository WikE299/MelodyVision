import type { NextRequest } from "next/server";
import type { ConversationState } from "@/lib/contracts";
import { getCharacterById } from "@/lib/characters";
import {
  buildMusicianConversationPrompt,
  getMusicianAgentProfile,
  isUsableConversationTurn,
  normalizeMusicianComment,
} from "@/lib/agents/musicians";
import {
  buildSingleGuideConversationPrompt,
  isUsableSingleGuideMessage,
  normalizeSingleGuideMessage,
  SINGLE_GUIDE_ID,
} from "@/lib/agents/single-guide";
import { streamLLM } from "@/lib/llm";
import { formatMusicContext } from "@/lib/prompts/system";
import {
  encodeConversationStreamEvent,
  parseConversationState,
  recordGuideMessage,
  recordMusicianMessage,
} from "@/lib/conversation";
import { insertConversationSnapshot } from "@/lib/db/research-data";

function createInitialTextFilter(displayName: string) {
  let buffer = "";
  let released = false;
  const escapedName = displayName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const cleanStart = (value: string) => value
    .replace(/^#{1,6}\s*/, "")
    .replace(/^\s*[-*]\s+/, "")
    .replace(new RegExp(`^${escapedName}[：:]\\s*`), "");

  return {
    push(chunk: string) {
      if (released) return chunk;
      buffer += chunk;
      if (buffer.length < 24 && !/[。！？!?]/.test(buffer)) return "";
      released = true;
      const visible = cleanStart(buffer);
      buffer = "";
      return visible;
    },
    flush() {
      if (released || !buffer) return "";
      released = true;
      const visible = cleanStart(buffer);
      buffer = "";
      return visible;
    },
  };
}

export async function POST(request: NextRequest) {
  let state: ConversationState;
  try {
    const body = await request.json() as Record<string, unknown>;
    state = parseConversationState(body.conversationState);
    const isSingle = state.condition === "single_agent";
    if (
      (isSingle && (state.turnOwner !== "guide" || state.status !== "streaming-guide")) ||
      (!isSingle && (state.turnOwner !== "musicians" || state.status !== "streaming-musician"))
    ) {
      return Response.json({ error: "No conversational turn is currently scheduled" }, { status: 409 });
    }

    const speakerId = state.queuedSpeakerIds[0];
    const profile = isSingle ? null : getMusicianAgentProfile(speakerId);
    if (
      !speakerId ||
      (isSingle && speakerId !== SINGLE_GUIDE_ID) ||
      (!isSingle && (!profile || !getCharacterById(speakerId)))
    ) {
      return Response.json({ error: "Scheduled speaker is invalid" }, { status: 400 });
    }
    if (!isSingle && state.selectedMusicianIds.some((id) => !getMusicianAgentProfile(id))) {
      return Response.json({ error: "Conversation contains an unknown musician" }, { status: 400 });
    }

    const musicianNames = Object.fromEntries(
      state.selectedMusicianIds.map((id) => [id, getCharacterById(id)!.name])
    );
    const musicContext = formatMusicContext(body.musicAnalysis || {});
    const displayName = isSingle ? "共创引导" : profile!.displayName;
    const systemPrompt = isSingle
      ? buildSingleGuideConversationPrompt({ state, musicContext })
      : buildMusicianConversationPrompt({
          profile: profile!,
          musicContext,
          conversationState: state,
          musicianNames,
        });
    const encoder = (event: Parameters<typeof encodeConversationStreamEvent>[0]) =>
      encodeConversationStreamEvent(event);

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(encoder({
          type: "meta",
          speakerId,
          speakerName: displayName,
        }));

        let rawContent = "";
        let model = "unknown";
        const visibleFilter = createInitialTextFilter(displayName);

        try {
          for await (const delta of streamLLM({
            systemPrompt,
            userMessage: "请继续当前共同对话，只输出你这一轮公开说出的正文。",
            temperature: isSingle ? 0.65 : profile!.temperature,
            maxTokens: 1400,
            signal: request.signal,
          })) {
            rawContent += delta.content;
            model = delta.model;
            const visible = visibleFilter.push(delta.content);
            if (visible) {
              controller.enqueue(encoder({ type: "delta", speakerId, delta: visible }));
            }
          }

          const remaining = visibleFilter.flush();
          if (remaining) {
            controller.enqueue(encoder({ type: "delta", speakerId, delta: remaining }));
          }

          const comment = isSingle
            ? normalizeSingleGuideMessage(rawContent)
            : normalizeMusicianComment(rawContent, profile!.displayName);
          const usable = isSingle
            ? isUsableSingleGuideMessage(comment)
            : isUsableConversationTurn(comment);
          if (!usable) {
            throw new Error("Agent returned an empty or incomplete streamed turn");
          }
          const nextState = isSingle
            ? recordGuideMessage(state, { speakerId, content: comment })
            : recordMusicianMessage(state, { speakerId, content: comment });
          await insertConversationSnapshot(nextState, isSingle ? "guide-turn-completed" : "musician-turn-completed").catch((error) => {
            console.error("Conversation turn snapshot failed:", error);
          });
          controller.enqueue(encoder({
            type: "complete",
            speakerId,
            comment,
            model,
            state: nextState,
          }));
        } catch (error) {
          if (!request.signal.aborted) {
            controller.enqueue(encoder({
              type: "error",
              speakerId,
              message: error instanceof Error ? error.message : "Musician stream failed",
            }));
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return Response.json(
      { error: "Invalid conversation turn request", detail: String(error) },
      { status: 400 }
    );
  }
}
