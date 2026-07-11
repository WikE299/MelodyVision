import type { ConversationState } from "../../contracts/conversation-state.ts";
import type { VisualBrief, VisualBriefFieldKey, VisualBriefFieldStatus } from "../../contracts/visual-brief.ts";

export const VISUAL_SCRIBE_PROFILE_VERSION = "2.0.0" as const;

export interface VisualScribeFieldDraft {
  value: string | string[] | null;
  status: VisualBriefFieldStatus;
  sourceIds: string[];
}

export interface VisualScribeDraft {
  fields: Record<VisualBriefFieldKey, VisualScribeFieldDraft>;
}

export interface VisualScribeInput {
  conversationState: ConversationState;
  previousBrief?: VisualBrief | null;
  musicContext: string;
}

export interface VisualScribeResult {
  brief: VisualBrief;
  model: string;
  attempts: number;
  profileVersion: typeof VISUAL_SCRIBE_PROFILE_VERSION;
  fallback: boolean;
  validationErrors: string[];
}
