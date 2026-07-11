import { callLLM, type LLMResponse } from "../../llm.ts";
import type { ConversationState } from "../../contracts/conversation-state.ts";
import {
  FACILITATOR_PROFILE_VERSION,
  type FacilitatorInput,
  type FacilitatorPlan,
} from "./types.ts";

type CompleteFacilitatorTurn = (params: {
  systemPrompt: string;
  userMessage: string;
  temperature?: number;
  maxTokens?: number;
}) => Promise<LLMResponse>;

function recentMusicianIds(state: ConversationState): string[] {
  return state.messages
    .filter((message) => message.role === "musician")
    .slice(-state.turnPolicy.maxMusiciansPerResponse)
    .map((message) => message.speakerId);
}

export function getEligibleSpeakerIds(state: ConversationState): string[] {
  if (state.turnOwner !== "system" || state.status !== "idle") return [];

  const recent = new Set(recentMusicianIds(state));
  const byFewestTurns = [...state.selectedMusicianIds].sort((left, right) => {
    const turnDifference =
      (state.musicianMemory[left]?.publicTurnCount || 0) -
      (state.musicianMemory[right]?.publicTurnCount || 0);
    if (turnDifference !== 0) return turnDifference;
    return state.selectedMusicianIds.indexOf(left) - state.selectedMusicianIds.indexOf(right);
  });
  const fresh = byFewestTurns.filter((id) => !recent.has(id));
  return fresh.length > 0 ? fresh : byFewestTurns;
}

function defaultInvitation(state: ConversationState) {
  return state.completedUserRounds === 0
    ? "哪一种听法更接近你，或者你看见了完全不同的画面？"
    : "听完这些回应，你脑海里的画面发生了什么变化？";
}

function stageSubtitleFor(
  speakerIds: string[],
  musicianNames: Record<string, string>
): string {
  const names = speakerIds.map((id) => musicianNames[id] || id);
  return names.length === 1
    ? `先听听${names[0]}从哪里进入这段音乐。`
    : `先听听${names.join("和")}看到的不同方向。`;
}

export function createDeterministicFacilitatorPlan(input: FacilitatorInput): FacilitatorPlan {
  const eligible = getEligibleSpeakerIds(input.state);
  if (eligible.length === 0) {
    throw new Error("No musicians are eligible to speak");
  }
  const count = Math.min(
    eligible.length,
    input.state.selectedMusicianIds.length === 1 ? 1 : input.state.turnPolicy.maxMusiciansPerResponse
  );
  const speakerIds = eligible.slice(0, count);

  return {
    speakerIds,
    stageSubtitle: stageSubtitleFor(speakerIds, input.musicianNames),
    userInvitation: defaultInvitation(input.state),
    source: "deterministic-fallback",
    profileVersion: FACILITATOR_PROFILE_VERSION,
  };
}

export function buildFacilitatorPrompt(input: FacilitatorInput, eligibleIds: string[]): string {
  const candidates = eligibleIds.map((id) => {
    const name = input.musicianNames[id] || id;
    const summary = input.preparedSummaries?.[id]?.trim() || "尚无公开发言摘要";
    return `- ${id}（${name}）：${summary}`;
  }).join("\n");
  const recent = recentMusicianIds(input.state);

  return `你是 MelodyVision 共创聆听室的隐形主持人。你不作为人物出现，只负责选择下一位发言者并写舞台字幕。

## 当前状态
- 对话阶段：${input.state.phase}
- 用户已参与：${input.state.completedUserRounds} / ${input.state.turnPolicy.maxUserRounds} 轮
- 最近发言者：${recent.length ? recent.join("、") : "无"}
- 本轮最多选择：${Math.min(eligibleIds.length, input.state.turnPolicy.maxMusiciansPerResponse)} 位

## 允许选择的候选
${candidates}

## 任务
从允许候选中选择 1-${Math.min(eligibleIds.length, input.state.turnPolicy.maxMusiciansPerResponse)} 位。优先让尚未充分发言且观点不同的人出现，避免连续重复同一人。

返回 JSON，且只能包含：
{"speakerIds":["候选 id"],"userInvitation":"发言后邀请用户的一句话"}

规则：
- speakerIds 只能来自允许候选，不得添加其他人物。
- userInvitation 不超过 38 个中文字符。
- 主持人不评论音乐，不总结成最终画面，不使用姓名之外的人格表演。
- userInvitation 必须给用户真实回答空间，不能只让用户二选一。`;
}

function cleanSubtitle(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const cleaned = value.replace(/[\r\n]+/g, " ").trim().slice(0, 38);
  return cleaned || fallback;
}

function parsePlan(content: string, input: FacilitatorInput, eligibleIds: string[]): FacilitatorPlan | null {
  try {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    if (!Array.isArray(parsed.speakerIds)) return null;
    const maximum = Math.min(eligibleIds.length, input.state.turnPolicy.maxMusiciansPerResponse);
    const speakerIds = [...new Set(parsed.speakerIds.filter((id): id is string => typeof id === "string"))];
    if (
      speakerIds.length < 1 ||
      speakerIds.length > maximum ||
      speakerIds.some((id) => !eligibleIds.includes(id))
    ) {
      return null;
    }

    const fallback = createDeterministicFacilitatorPlan(input);
    return {
      speakerIds,
      stageSubtitle: stageSubtitleFor(speakerIds, input.musicianNames),
      userInvitation: cleanSubtitle(parsed.userInvitation, fallback.userInvitation),
      source: "model",
      profileVersion: FACILITATOR_PROFILE_VERSION,
    };
  } catch {
    return null;
  }
}

export async function runFacilitatorAgent(
  input: FacilitatorInput,
  complete: CompleteFacilitatorTurn = callLLM
): Promise<FacilitatorPlan> {
  const eligibleIds = getEligibleSpeakerIds(input.state);
  const fallback = createDeterministicFacilitatorPlan(input);

  try {
    const response = await complete({
      systemPrompt: buildFacilitatorPrompt(input, eligibleIds),
      userMessage: "安排下一轮发言。只返回 JSON。",
      temperature: 0.3,
      maxTokens: 600,
    });
    const plan = parsePlan(response.content, input, eligibleIds);
    return plan ? { ...plan, model: response.model } : fallback;
  } catch {
    return fallback;
  }
}
