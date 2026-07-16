import type {
  ConversationMessage,
  ConversationState,
} from "../contracts/conversation-state.ts";
import { VERSION_2_SCHEMA_VERSION } from "../contracts/shared.ts";
import { isInteractiveCondition } from "../contracts/study-trial.ts";

const PHASES = new Set(["preparing", "opening", "exploration", "convergence", "ready", "complete"]);
const STATUSES = new Set(["idle", "streaming-musician", "streaming-guide", "awaiting-user", "updating-brief", "ready-to-generate", "generating", "completed", "failed"]);
const TURN_OWNERS = new Set(["system", "musicians", "guide", "user"]);
const ROLES = new Set(["musician", "guide", "user", "facilitator"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isMessage(value: unknown, selectedIds: Set<string>, guideId?: string): value is ConversationMessage {
  if (!isRecord(value)) return false;
  if (
    typeof value.id !== "string" ||
    typeof value.sequence !== "number" ||
    typeof value.role !== "string" ||
    !ROLES.has(value.role) ||
    typeof value.speakerId !== "string" ||
    typeof value.content !== "string" ||
    value.content.length > 5000 ||
    typeof value.createdAt !== "string"
  ) {
    return false;
  }
  if (value.role === "musician") return selectedIds.has(value.speakerId);
  if (value.role === "guide") return Boolean(guideId) && value.speakerId === guideId;
  return true;
}

export function parseConversationState(value: unknown): ConversationState {
  if (!isRecord(value)) throw new Error("conversationState must be an object");
  if (value.schemaVersion !== VERSION_2_SCHEMA_VERSION) {
    throw new Error("Unsupported conversationState schemaVersion");
  }
  if (!isStringArray(value.selectedMusicianIds)) {
    throw new Error("conversationState selectedMusicianIds are invalid");
  }
  const selectedMusicianIds = value.selectedMusicianIds;
  const selectedSet = new Set(selectedMusicianIds);
  if (!isInteractiveCondition(value.condition)) {
    throw new Error("conversationState condition is invalid");
  }
  const condition = value.condition;
  const guideId = typeof value.guideId === "string" ? value.guideId : undefined;
  if (!isRecord(value.turnPolicy)) {
    throw new Error("conversationState turnPolicy is invalid");
  }
  const policy = value.turnPolicy;
  if (
    !Number.isInteger(policy.maxConsecutiveMusicianMessages) ||
    Number(policy.maxConsecutiveMusicianMessages) < 1 ||
    Number(policy.maxConsecutiveMusicianMessages) > 2 ||
    !Number.isInteger(policy.maxMusiciansPerResponse) ||
    Number(policy.maxMusiciansPerResponse) < 1 ||
    Number(policy.maxMusiciansPerResponse) > 2 ||
    !Number.isInteger(policy.maxUserRounds) ||
    Number(policy.maxUserRounds) < 1 ||
    Number(policy.maxUserRounds) > 4 ||
    typeof policy.userMayInterrupt !== "boolean" ||
    typeof policy.userMayGenerateEarly !== "boolean"
  ) {
    throw new Error("conversationState turnPolicy exceeds supported limits");
  }
  if (condition === "single_agent" && policy.userMayGenerateEarly) {
    throw new Error("Single-agent conversations cannot generate early");
  }
  if (
    selectedSet.size !== selectedMusicianIds.length ||
    selectedMusicianIds.length < 1 ||
    selectedMusicianIds.length > 4 ||
    (condition === "single_agent" && !guideId)
  ) {
    throw new Error("conversationState requires 1-4 unique musicians");
  }
  if (
    typeof value.id !== "string" ||
    typeof value.trialId !== "string" ||
    typeof value.sessionId !== "string" ||
    typeof value.musicProfileId !== "string" ||
    typeof value.phase !== "string" ||
    !PHASES.has(value.phase) ||
    typeof value.status !== "string" ||
    !STATUSES.has(value.status) ||
    typeof value.turnOwner !== "string" ||
    !TURN_OWNERS.has(value.turnOwner) ||
    !isStringArray(value.activeSpeakerIds) ||
    !isStringArray(value.queuedSpeakerIds) ||
    value.activeSpeakerIds.some((id) => !selectedSet.has(id) && id !== guideId) ||
    value.queuedSpeakerIds.some((id) => !selectedSet.has(id) && id !== guideId) ||
    new Set(value.queuedSpeakerIds).size !== value.queuedSpeakerIds.length ||
    value.queuedSpeakerIds.length > Number(policy.maxMusiciansPerResponse) ||
    !Array.isArray(value.messages) ||
    value.messages.length > 100 ||
    !value.messages.every((message) => isMessage(message, selectedSet, guideId)) ||
    !isRecord(value.musicianMemory) ||
    !isRecord(value.facilitator) ||
    !Number.isInteger(value.completedUserRounds) ||
    Number(value.completedUserRounds) < 0 ||
    Number(value.completedUserRounds) > Number(policy.maxUserRounds) ||
    !Number.isInteger(value.consecutiveMusicianMessages) ||
    Number(value.consecutiveMusicianMessages) < 0 ||
    Number(value.consecutiveMusicianMessages) > Number(policy.maxConsecutiveMusicianMessages) ||
    typeof value.userCanInterrupt !== "boolean" ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string"
  ) {
    throw new Error("conversationState shape is invalid");
  }
  if (
    (value.status === "streaming-musician") !== (value.turnOwner === "musicians") ||
    (value.status === "streaming-guide") !== (value.turnOwner === "guide") ||
    (["streaming-musician", "streaming-guide"].includes(value.status as string) && value.queuedSpeakerIds.length === 0)
  ) {
    throw new Error("conversationState turn ownership is inconsistent");
  }

  return value as unknown as ConversationState;
}
