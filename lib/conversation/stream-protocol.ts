import type { ConversationState } from "../contracts/conversation-state.ts";

export type ConversationStreamEvent =
  | { type: "meta"; speakerId: string; speakerName: string }
  | { type: "delta"; speakerId: string; delta: string }
  | {
      type: "complete";
      speakerId: string;
      comment: string;
      model: string;
      state: ConversationState;
    }
  | { type: "error"; speakerId?: string; message: string };

export function encodeConversationStreamEvent(event: ConversationStreamEvent): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

export async function readConversationStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: ConversationStreamEvent) => void
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = done ? "" : lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      onEvent(JSON.parse(line) as ConversationStreamEvent);
    }

    if (done) {
      if (buffer.trim()) onEvent(JSON.parse(buffer) as ConversationStreamEvent);
      break;
    }
  }
}
