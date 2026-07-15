import type {
  IsoDateTime,
  SourceReference,
  Version2SchemaVersion,
} from "./shared";
import type { InteractiveCondition } from "./study-trial";

export type ConversationPhase =
  | "preparing"
  | "opening"
  | "exploration"
  | "convergence"
  | "ready"
  | "complete";

export type ConversationStatus =
  | "idle"
  | "streaming-musician"
  | "streaming-guide"
  | "awaiting-user"
  | "updating-brief"
  | "ready-to-generate"
  | "generating"
  | "completed"
  | "failed";

export type ConversationTurnOwner = "system" | "musicians" | "guide" | "user";
export type ConversationMessageRole = "musician" | "guide" | "user" | "facilitator";
export type ConversationMessagePresentation = "speech-bubble" | "stage-subtitle";

export interface ConversationTurnPolicy {
  maxConsecutiveMusicianMessages: number;
  maxMusiciansPerResponse: number;
  maxUserRounds: number;
  userMayInterrupt: boolean;
  userMayGenerateEarly: boolean;
}

export const DEFAULT_CONVERSATION_TURN_POLICY: ConversationTurnPolicy = {
  maxConsecutiveMusicianMessages: 2,
  maxMusiciansPerResponse: 2,
  maxUserRounds: 4,
  userMayInterrupt: true,
  userMayGenerateEarly: false,
};

export interface ConversationMessage {
  id: string;
  sequence: number;
  role: ConversationMessageRole;
  speakerId: string;
  content: string;
  presentation: ConversationMessagePresentation;
  replyToMessageId?: string;
  sources: SourceReference[];
  createdAt: IsoDateTime;
}

export interface MusicianPerspective {
  observation: string;
  interpretation: string;
  visualHypotheses: string[];
  questionsForUser: string[];
  musicEvidenceIds: string[];
}

export interface MusicianConversationMemory {
  musicianId: string;
  preparedPerspective?: MusicianPerspective;
  publicTurnCount: number;
  lastMessageId?: string;
}

export interface FacilitatorState {
  lastSubtitleMessageId?: string;
  pendingQuestion?: string;
  askedQuestions: string[];
}

export interface VisualBriefReference {
  id: string;
  version: number;
}

export interface ConversationState {
  schemaVersion: Version2SchemaVersion;
  id: string;
  trialId: string;
  sessionId: string;
  musicProfileId: string;
  condition: InteractiveCondition;
  selectedMusicianIds: string[];
  guideId?: string;
  phase: ConversationPhase;
  status: ConversationStatus;
  turnOwner: ConversationTurnOwner;
  turnPolicy: ConversationTurnPolicy;
  completedUserRounds: number;
  consecutiveMusicianMessages: number;
  userCanInterrupt: boolean;
  activeSpeakerIds: string[];
  queuedSpeakerIds: string[];
  messages: ConversationMessage[];
  musicianMemory: Record<string, MusicianConversationMemory>;
  facilitator: FacilitatorState;
  visualBriefRef: VisualBriefReference | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}
