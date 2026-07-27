import type { InteractiveCondition } from "./contracts";

export async function startConversationSession(input: {
  sessionId: string;
  trialId: string;
  musicProfileId: string;
  condition: InteractiveCondition;
  selectedMusicianIds: string[];
}) {
  const response = await fetch("/api/conversation/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...input,
      preparedSummaries: {},
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Conversation initialization failed");
  }
  return data as {
    state: unknown;
    facilitatorPlan: unknown;
  };
}
