import { callLLM, type LLMResponse } from "../../llm.ts";
import type { ConversationState } from "../../contracts/conversation-state.ts";
import { goalForVisualBrief, ROUND_GUIDANCE } from "../../conversation/round-protocol.ts";
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

const IDENTITY_GUARDS: Partial<Record<string, { required: string; forbidden: string[] }>> = {
  armstrong: {
    required: "此处的阿姆斯特朗是 Louis Armstrong，爵士小号手和歌手，不是宇航员 Neil Armstrong。",
    forbidden: ["登月", "月球", "宇航", "太空", "NASA", "阿波罗"],
  },
};

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

function requiredCoverageSpeakerIds(
  state: ConversationState,
  eligibleIds: string[]
): string[] {
  const eligible = new Set(eligibleIds);
  return state.selectedMusicianIds.filter(
    (id) => eligible.has(id) && (state.musicianMemory[id]?.publicTurnCount || 0) === 0
  );
}

function maxSpeakersForTurn(state: ConversationState, eligibleCount: number): number {
  const uncoveredCount = requiredCoverageSpeakerIds(
    state,
    getEligibleSpeakerIds(state)
  ).length;
  return Math.min(
    eligibleCount,
    state.turnPolicy.maxMusiciansPerResponse,
    uncoveredCount > 0 ? uncoveredCount : 2
  );
}

function nextGoal(input: FacilitatorInput): FacilitatorGoal {
  return goalForVisualBrief(input.visualBrief, input.state.completedUserRounds);
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
  const requiredCoverage = requiredCoverageSpeakerIds(input.state, eligible);
  const count = maxSpeakersForTurn(input.state, eligible.length);
  const speakerIds = requiredCoverage.length > 0
    ? requiredCoverage.slice(0, count)
    : eligible.slice(0, count);
  const currentGoal = nextGoal(input);
  const guidance = ROUND_GUIDANCE[currentGoal];

  return {
    speakerIds,
    stageSubtitle: input.state.phase === "convergence"
      ? "你的画面线索已经足够清晰，再听一个回应，我们就把它聚拢起来。"
      : stageSubtitleFor(speakerIds, input.musicianNames),
    userInvitation: input.state.phase === "convergence"
      ? "这些线索已经可以形成画面，不需要继续补充。"
      : guidance.question,
    currentGoal,
    sentenceStarters: [],
    source: "deterministic-fallback",
    profileVersion: FACILITATOR_PROFILE_VERSION,
  };
}

export function buildFacilitatorPrompt(input: FacilitatorInput, eligibleIds: string[]): string {
  const candidates = eligibleIds.map((id) => {
    const name = input.musicianNames[id] || id;
    const summary = input.preparedSummaries?.[id]?.trim() || "尚无公开发言摘要";
    const identity = input.musicianIdentityContexts?.[id]?.trim() || "";
    const guard = IDENTITY_GUARDS[id]?.required || "";
    return `- ${id}（${name}）：身份=${identity || "未提供"} ${guard}\n  已有发言：${summary}`;
  }).join("\n");
  const recent = recentMusicianIds(input.state);
  const currentGoal = nextGoal(input);
  const guidance = ROUND_GUIDANCE[currentGoal];
  const requiredCoverage = requiredCoverageSpeakerIds(input.state, eligibleIds);
  const maximum = maxSpeakersForTurn(input.state, eligibleIds.length);
  const briefSummary = input.visualBrief
    ? Object.entries(input.visualBrief.fields).map(([key, field]) =>
        `${key}: ${field.status}${field.value ? ` = ${Array.isArray(field.value) ? field.value.join(" / ") : field.value}` : ""}`
      ).join("\n")
    : "尚无画面记录。";

  return `你是 MelodyVision 共创聆听室的隐形主持人。你不作为人物出现，只负责选择下一位发言者并写舞台字幕。四类画面目标是你的内部观察框架，不是要用户逐项填写的问卷。

## 当前状态
- 对话阶段：${input.state.phase}
- 用户已参与：${input.state.completedUserRounds} / ${input.state.turnPolicy.maxUserRounds} 轮
- 最近发言者：${recent.length ? recent.join("、") : "无"}
- 本轮选择数量：${requiredCoverage.length > 0 ? `必须覆盖 ${requiredCoverage.length} 位尚未发言者` : `最多 ${maximum} 位`}
- 当前最值得展开的缺口：${guidance.question}

## 当前画面记录
${briefSummary}

## 允许选择的候选
${candidates}

## 任务
从允许候选中选择 1-${maximum} 位。优先让尚未充分发言且观点不同的人出现，避免连续重复同一人。
${requiredCoverage.length > 0 ? `本轮必须让这些尚未发言的音乐家全部出现：${requiredCoverage.join("、")}。不得遗漏。` : ""}

返回 JSON，且只能包含：
{"speakerIds":["候选 id"],"transition":"承接已发生对话的一句主持话","userInvitation":"发言后邀请用户的一句话"}

规则：
- speakerIds 只能来自允许候选，不得添加其他人物。
- 不得把音乐家与同名人物、作品或历史事件混淆；候选中的身份说明优先于你的常识联想。
- userInvitation 不超过 30 个中文字符，使用“如果愿意”“可以再说说”等轻提示语气，不写成必须作答的题目。
- transition 不超过 52 个中文字符，要说明“刚才聊出了什么、这一轮继续寻找什么”，不能只报姓名。
- userInvitation 围绕当前缺口 ${currentGoal}，一次只问一个容易回答的开放问题。参考方向：${guidance.question}
- 必须承接用户已经说过的词或关系，不能要求用户按字段、顺序或固定句式作答。
- 不提供具体场景例子，不用星空、沙漠、森林、人物等意象替用户开题。
- 如果当前阶段是 convergence，不再打开新方向，只说明线索已经足够并允许用户补充。
- 不得向用户说出 subject-space、motion-composition、light-color-material、meaning-constraints 或 VisualBrief 等内部名称。
- 主持人不评论音乐，不总结成最终画面，不使用姓名之外的人格表演。
- userInvitation 必须给用户真实回答空间，不能只让用户二选一。`;
}

function hasIdentityConflict(plan: { speakerIds: string[]; stageSubtitle: string; userInvitation: string; sentenceStarters: string[] }) {
  const text = [plan.stageSubtitle, plan.userInvitation, ...plan.sentenceStarters].join(" ").toLowerCase();
  return plan.speakerIds.some((id) => IDENTITY_GUARDS[id]?.forbidden.some((term) => text.includes(term.toLowerCase())));
}

function cleanSubtitle(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const singleLine = value
    .replace(/[\r\n]+/g, " ")
    .replace(/subject-space/gi, "画面的主体与空间")
    .replace(/motion-composition/gi, "画面的运动")
    .replace(/light-color-material/gi, "光线、颜色与触感")
    .replace(/meaning-constraints/gi, "想保留的意义")
    .replace(/VisualBrief/gi, "当前画面")
    .trim();
  const cleaned = singleLine.length > 52 ? `${singleLine.slice(0, 51)}…` : singleLine;
  return cleaned || fallback;
}

function parsePlan(content: string, input: FacilitatorInput, eligibleIds: string[]): FacilitatorPlan | null {
  try {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    if (!Array.isArray(parsed.speakerIds)) return null;
    const maximum = maxSpeakersForTurn(input.state, eligibleIds.length);
    const requiredCoverage = requiredCoverageSpeakerIds(input.state, eligibleIds);
    const speakerIds = [...new Set(parsed.speakerIds.filter((id): id is string => typeof id === "string"))];
    if (
      speakerIds.length < 1 ||
      speakerIds.length > maximum ||
      speakerIds.some((id) => !eligibleIds.includes(id)) ||
      requiredCoverage.some((id) => !speakerIds.includes(id))
    ) {
      return null;
    }

    const fallback = createDeterministicFacilitatorPlan(input);
    const plan: FacilitatorPlan = {
      speakerIds,
      stageSubtitle: cleanSubtitle(parsed.transition, fallback.stageSubtitle),
      userInvitation: fallback.userInvitation,
      currentGoal: fallback.currentGoal,
      sentenceStarters: [],
      source: "model",
      profileVersion: FACILITATOR_PROFILE_VERSION,
    };
    return hasIdentityConflict(plan) ? null : plan;
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
