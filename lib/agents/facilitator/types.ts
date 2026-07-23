import type { ConversationState } from "../../contracts/conversation-state.ts";
import type { VisualBrief } from "../../contracts/visual-brief.ts";
import type { ConversationRoundGoal } from "../../conversation/round-protocol.ts";

export const FACILITATOR_PROFILE_VERSION = "2.3.0" as const;

export type FacilitatorGoal = ConversationRoundGoal;

export interface FacilitatorInput {
  state: ConversationState;
  musicianNames: Record<string, string>;
  musicianIdentityContexts?: Record<string, string>;
  preparedSummaries?: Record<string, string>;
  visualBrief?: VisualBrief | null;
}

export interface FacilitatorPlan {
  speakerIds: string[];
  stageSubtitle: string;
  userInvitation: string;
  currentGoal: FacilitatorGoal;
  sentenceStarters: string[];
  source: "model" | "deterministic-fallback";
  model?: string;
  profileVersion: typeof FACILITATOR_PROFILE_VERSION;
}
