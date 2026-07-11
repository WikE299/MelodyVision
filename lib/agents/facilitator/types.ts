import type { ConversationState } from "../../contracts/conversation-state.ts";

export const FACILITATOR_PROFILE_VERSION = "2.0.0" as const;

export interface FacilitatorInput {
  state: ConversationState;
  musicianNames: Record<string, string>;
  preparedSummaries?: Record<string, string>;
}

export interface FacilitatorPlan {
  speakerIds: string[];
  stageSubtitle: string;
  userInvitation: string;
  source: "model" | "deterministic-fallback";
  model?: string;
  profileVersion: typeof FACILITATOR_PROFILE_VERSION;
}
