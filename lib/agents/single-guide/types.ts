import type { ConversationState } from "../../contracts/conversation-state.ts";

export const SINGLE_GUIDE_ID = "co_creation_guide" as const;
export const SINGLE_GUIDE_PROFILE_VERSION = "1.0.0" as const;

export interface SingleGuideInput {
  state: ConversationState;
  musicContext: string;
}
