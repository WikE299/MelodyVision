import { callLLM, type LLMResponse } from "../../llm.ts";
import type { ConversationState } from "../../contracts/conversation-state.ts";
import {
  FACILITATOR_PROFILE_VERSION,
  type FacilitatorInput,
  type FacilitatorGoal,
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

const GOAL_GUIDANCE: Record<FacilitatorGoal, { question: string; starters: string[] }> = {
  "subject-space": {
    question: "先别急着说完整故事：这段音乐里，你最先看见了什么？它在哪里？",
    starters: ["我最先看见的是……", "它像是在……", "周围是一片……"],
  },
  "motion-composition": {
    question: "让画面动起来：它正在靠近、散开、上升，还是停在原地？",
    starters: ["它正在……", "画面从……向……", "最有力量的部分在……"],
  },
  "light-color-material": {
    question: "再靠近一点：这里的光、颜色或触感，最像什么？",
    starters: ["光从……照进来", "颜色更接近……", "它摸起来像……"],
  },
  "meaning-constraints": {
    question: "最后留下一点属于你的东西：什么必须保留，什么不该出现？",
    starters: ["我希望一定保留……", "它对我来说像……", "画面里不要出现……"],
  },
};

function nextGoal(input: FacilitatorInput): FacilitatorGoal {
  if (input.state.completedUserRounds === 0) return "subject-space";
  if (input.state.completedUserRounds === 1) return "motion-composition";
  if (input.state.completedUserRounds === 2) return "light-color-material";
  return "meaning-constraints";
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
  const currentGoal = nextGoal(input);
  const guidance = GOAL_GUIDANCE[currentGoal];

  return {
    speakerIds,
    stageSubtitle: input.state.messages.length === 0
      ? "我们会把这段音乐慢慢聊成一幅画。先听一两个方向，再从你最先看见的东西开始。"
      : stageSubtitleFor(speakerIds, input.musicianNames),
    userInvitation: guidance.question,
    currentGoal,
    sentenceStarters: guidance.starters,
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
  const currentGoal = nextGoal(input);
  const guidance = GOAL_GUIDANCE[currentGoal];
  const briefSummary = input.visualBrief
    ? Object.entries(input.visualBrief.fields).map(([key, field]) =>
        `${key}: ${field.status}${field.value ? ` = ${Array.isArray(field.value) ? field.value.join(" / ") : field.value}` : ""}`
      ).join("\n")
    : "尚无画面记录。";

  return `你是 MelodyVision 共创聆听室的隐形主持人。你不作为人物出现，只负责选择下一位发言者并写舞台字幕。

## 当前状态
- 对话阶段：${input.state.phase}
- 用户已参与：${input.state.completedUserRounds} / ${input.state.turnPolicy.maxUserRounds} 轮
- 最近发言者：${recent.length ? recent.join("、") : "无"}
- 本轮最多选择：${Math.min(eligibleIds.length, input.state.turnPolicy.maxMusiciansPerResponse)} 位
- 本轮画面目标：${currentGoal}

## 当前画面记录
${briefSummary}

## 允许选择的候选
${candidates}

## 任务
从允许候选中选择 1-${Math.min(eligibleIds.length, input.state.turnPolicy.maxMusiciansPerResponse)} 位。优先让尚未充分发言且观点不同的人出现，避免连续重复同一人。

返回 JSON，且只能包含：
{"speakerIds":["候选 id"],"transition":"承接已发生对话的一句主持话","userInvitation":"发言后邀请用户的一句话","sentenceStarters":["句子开头"]}

规则：
- speakerIds 只能来自允许候选，不得添加其他人物。
- userInvitation 不超过 38 个中文字符。
- transition 不超过 52 个中文字符，要说明“刚才聊出了什么、这一轮继续寻找什么”，不能只报姓名。
- userInvitation 围绕本轮目标 ${currentGoal}，一次只问一个容易回答的问题。参考方向：${guidance.question}
- sentenceStarters 返回 2-3 个不超过 14 字的自然句子开头，帮助用户开口，不得变成参数标签。
- 主持人不评论音乐，不总结成最终画面，不使用姓名之外的人格表演。
- userInvitation 必须给用户真实回答空间，不能只让用户二选一。`;
}

function cleanSubtitle(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const singleLine = value.replace(/[\r\n]+/g, " ").trim();
  const cleaned = singleLine.length > 52 ? `${singleLine.slice(0, 51)}…` : singleLine;
  return cleaned || fallback;
}

function cleanStarters(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const starters = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.replace(/[\r\n]+/g, " ").trim().slice(0, 18))
    .filter(Boolean)
    .slice(0, 3);
  return starters.length >= 2 ? starters : fallback;
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
      stageSubtitle: cleanSubtitle(parsed.transition, fallback.stageSubtitle),
      userInvitation: cleanSubtitle(parsed.userInvitation, fallback.userInvitation),
      currentGoal: fallback.currentGoal,
      sentenceStarters: cleanStarters(parsed.sentenceStarters, fallback.sentenceStarters),
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
