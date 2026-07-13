import type { ConversationState } from "../../contracts/conversation-state.ts";
import type { VisualBrief } from "../../contracts/visual-brief.ts";

export const FACILITATOR_PROFILE_VERSION = "2.2.0" as const;

export type FacilitatorGoal =
  | "subject-space"
  | "motion-composition"
  | "light-color-material"
  | "meaning-constraints";

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
