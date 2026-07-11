import {
  DEFAULT_CONVERSATION_TURN_POLICY,
  type ConversationMessage,
  type ConversationState,
  type ConversationTurnPolicy,
} from "../contracts/conversation-state.ts";
import { VERSION_2_SCHEMA_VERSION } from "../contracts/shared.ts";

export interface ConversationRuntime {
  now?: () => string;
  createId?: () => string;
}

export interface CreateConversationStateInput {
  id?: string;
  sessionId: string;
  musicProfileId: string;
  selectedMusicianIds: string[];
  turnPolicy?: Partial<ConversationTurnPolicy>;
}

export interface FacilitatedMusicianTurn {
  speakerIds: string[];
  stageSubtitle: string;
  userInvitation: string;
}

function runtimeValues(runtime?: ConversationRuntime) {
  return {
    now: runtime?.now || (() => new Date().toISOString()),
    createId: runtime?.createId || (() => crypto.randomUUID()),
  };
}

function appendMessage(
  state: ConversationState,
  message: Omit<ConversationMessage, "id" | "sequence" | "createdAt">,
  runtime?: ConversationRuntime
): ConversationState {
  const { now, createId } = runtimeValues(runtime);
  const nextMessage: ConversationMessage = {
    ...message,
    id: createId(),
    sequence: state.messages.length + 1,
    createdAt: now(),
  };

  return {
    ...state,
    messages: [...state.messages, nextMessage],
    updatedAt: nextMessage.createdAt,
  };
}

function assertSelectedMusicians(ids: string[]) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length < 1 || uniqueIds.length > 4 || uniqueIds.length !== ids.length) {
    throw new Error("Conversation requires 1-4 unique musicians");
  }
  return uniqueIds;
}

export function createConversationState(
  input: CreateConversationStateInput,
  runtime?: ConversationRuntime
): ConversationState {
  const selectedMusicianIds = assertSelectedMusicians(input.selectedMusicianIds);
  const { now, createId } = runtimeValues(runtime);
  const timestamp = now();
  const turnPolicy = {
    ...DEFAULT_CONVERSATION_TURN_POLICY,
    ...input.turnPolicy,
  };

  return {
    schemaVersion: VERSION_2_SCHEMA_VERSION,
    id: input.id || createId(),
    sessionId: input.sessionId,
    musicProfileId: input.musicProfileId,
    selectedMusicianIds,
    phase: "opening",
    status: "idle",
    turnOwner: "system",
    turnPolicy,
    completedUserRounds: 0,
    consecutiveMusicianMessages: 0,
    userCanInterrupt: turnPolicy.userMayInterrupt,
    activeSpeakerIds: [],
    queuedSpeakerIds: [],
    messages: [],
    musicianMemory: Object.fromEntries(
      selectedMusicianIds.map((musicianId) => [
        musicianId,
        { musicianId, publicTurnCount: 0 },
      ])
    ),
    facilitator: {
      askedQuestions: [],
    },
    visualBriefRef: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function scheduleMusicianTurn(
  state: ConversationState,
  turn: FacilitatedMusicianTurn,
  runtime?: ConversationRuntime
): ConversationState {
  if (state.turnOwner !== "system" || state.status !== "idle") {
    throw new Error("A musician turn can only be scheduled while the system owns an idle turn");
  }

  const speakerIds = [...new Set(turn.speakerIds)];
  const remainingCapacity = Math.max(
    0,
    state.turnPolicy.maxConsecutiveMusicianMessages - state.consecutiveMusicianMessages
  );
  const speakerLimit = Math.min(state.turnPolicy.maxMusiciansPerResponse, remainingCapacity);

  if (
    speakerIds.length < 1 ||
    speakerIds.length > speakerLimit ||
    speakerIds.some((id) => !state.selectedMusicianIds.includes(id))
  ) {
    throw new Error("Facilitator selected an invalid musician turn");
  }

  let nextState: ConversationState = {
    ...state,
    status: "streaming-musician",
    turnOwner: "musicians",
    activeSpeakerIds: speakerIds,
    queuedSpeakerIds: speakerIds,
    facilitator: {
      ...state.facilitator,
      pendingQuestion: turn.userInvitation,
    },
  };

  if (turn.stageSubtitle.trim()) {
    nextState = appendMessage(
      nextState,
      {
        role: "facilitator",
        speakerId: "facilitator",
        content: turn.stageSubtitle.trim(),
        presentation: "stage-subtitle",
        sources: [],
      },
      runtime
    );
    nextState = {
      ...nextState,
      facilitator: {
        ...nextState.facilitator,
        lastSubtitleMessageId: nextState.messages.at(-1)?.id,
      },
    };
  }

  return nextState;
}

export function recordMusicianMessage(
  state: ConversationState,
  input: { speakerId: string; content: string },
  runtime?: ConversationRuntime
): ConversationState {
  if (
    state.turnOwner !== "musicians" ||
    state.status !== "streaming-musician" ||
    !state.queuedSpeakerIds.includes(input.speakerId)
  ) {
    throw new Error("Musician does not currently own a scheduled turn");
  }
  if (!input.content.trim()) {
    throw new Error("Musician message cannot be empty");
  }

  let nextState = appendMessage(
    state,
    {
      role: "musician",
      speakerId: input.speakerId,
      content: input.content.trim(),
      presentation: "speech-bubble",
      sources: [],
    },
    runtime
  );
  const lastMessageId = nextState.messages.at(-1)?.id;
  const queuedSpeakerIds = state.queuedSpeakerIds.filter((id) => id !== input.speakerId);
  const consecutiveMusicianMessages = state.consecutiveMusicianMessages + 1;
  const mustYield =
    queuedSpeakerIds.length === 0 ||
    consecutiveMusicianMessages >= state.turnPolicy.maxConsecutiveMusicianMessages;

  nextState = {
    ...nextState,
    consecutiveMusicianMessages,
    queuedSpeakerIds: mustYield ? [] : queuedSpeakerIds,
    activeSpeakerIds: mustYield ? [] : queuedSpeakerIds,
    musicianMemory: {
      ...state.musicianMemory,
      [input.speakerId]: {
        ...state.musicianMemory[input.speakerId],
        musicianId: input.speakerId,
        publicTurnCount: (state.musicianMemory[input.speakerId]?.publicTurnCount || 0) + 1,
        lastMessageId,
      },
    },
  };

  if (!mustYield) return nextState;

  const reachedRoundLimit = nextState.completedUserRounds >= nextState.turnPolicy.maxUserRounds;
  const invitation = reachedRoundLimit
    ? "这些画面线索已经聚拢，可以继续生成，也可以再补一句。"
    : nextState.facilitator.pendingQuestion || "你听见了什么，又看见了怎样的画面？";

  nextState = appendMessage(
    {
      ...nextState,
      phase: reachedRoundLimit ? "ready" : "exploration",
      status: reachedRoundLimit ? "ready-to-generate" : "awaiting-user",
      turnOwner: "user",
    },
    {
      role: "facilitator",
      speakerId: "facilitator",
      content: invitation,
      presentation: "stage-subtitle",
      sources: [],
    },
    runtime
  );

  return {
    ...nextState,
    facilitator: {
      ...nextState.facilitator,
      lastSubtitleMessageId: nextState.messages.at(-1)?.id,
      pendingQuestion: undefined,
      askedQuestions: reachedRoundLimit
        ? nextState.facilitator.askedQuestions
        : [...nextState.facilitator.askedQuestions, invitation],
    },
  };
}

export function recordUserMessage(
  state: ConversationState,
  content: string,
  runtime?: ConversationRuntime
): ConversationState {
  if (state.turnOwner !== "user" && !state.userCanInterrupt) {
    throw new Error("User does not currently own the turn");
  }
  if (!content.trim()) {
    throw new Error("User message cannot be empty");
  }

  if (state.completedUserRounds >= state.turnPolicy.maxUserRounds) {
    const finalNoteState = appendMessage(
      state,
      {
        role: "user",
        speakerId: "user",
        content: content.trim(),
        presentation: "speech-bubble",
        sources: [],
      },
      runtime
    );
    return {
      ...finalNoteState,
      phase: "ready",
      status: "ready-to-generate",
      turnOwner: "user",
      activeSpeakerIds: [],
      queuedSpeakerIds: [],
    };
  }

  const interrupted = state.turnOwner !== "user";
  const completedUserRounds = Math.min(
    state.completedUserRounds + 1,
    state.turnPolicy.maxUserRounds
  );
  const nextState = appendMessage(
    state,
    {
      role: "user",
      speakerId: "user",
      content: content.trim(),
      presentation: "speech-bubble",
      sources: [],
    },
    runtime
  );

  return {
    ...nextState,
    phase: completedUserRounds >= state.turnPolicy.maxUserRounds ? "convergence" : "exploration",
    status: "idle",
    turnOwner: "system",
    completedUserRounds,
    consecutiveMusicianMessages: 0,
    activeSpeakerIds: [],
    queuedSpeakerIds: [],
    facilitator: {
      ...nextState.facilitator,
      pendingQuestion: undefined,
    },
    ...(interrupted ? { userCanInterrupt: state.turnPolicy.userMayInterrupt } : {}),
  };
}

export function requestUserTurn(
  state: ConversationState,
  subtitle = "先停在这里，说说你此刻听见或看见了什么。",
  runtime?: ConversationRuntime
): ConversationState {
  if (!state.turnPolicy.userMayInterrupt) {
    throw new Error("This conversation does not allow user interruption");
  }
  if (state.phase === "ready" || state.phase === "complete") {
    throw new Error("Conversation no longer has an active musician turn");
  }
  if (state.turnOwner === "user") return state;

  const nextState = appendMessage(
    {
      ...state,
      status: "awaiting-user",
      turnOwner: "user",
      activeSpeakerIds: [],
      queuedSpeakerIds: [],
    },
    {
      role: "facilitator",
      speakerId: "facilitator",
      content: subtitle,
      presentation: "stage-subtitle",
      sources: [],
    },
    runtime
  );

  return {
    ...nextState,
    facilitator: {
      ...nextState.facilitator,
      lastSubtitleMessageId: nextState.messages.at(-1)?.id,
      pendingQuestion: subtitle,
    },
  };
}

export function requestGeneration(
  state: ConversationState,
  runtime?: Pick<ConversationRuntime, "now">
): ConversationState {
  if (!state.turnPolicy.userMayGenerateEarly && state.phase !== "ready") {
    throw new Error("Conversation is not ready to generate");
  }
  return {
    ...state,
    phase: "ready",
    status: "ready-to-generate",
    turnOwner: "user",
    activeSpeakerIds: [],
    queuedSpeakerIds: [],
    updatedAt: (runtime?.now || (() => new Date().toISOString()))(),
  };
}
