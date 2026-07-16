import { callLLM, type LLMResponse } from "../../llm.ts";
import {
  MUSICIAN_PROFILE_VERSION,
  type MusicianAgentInput,
  type MusicianAgentResult,
} from "./types.ts";

type CompleteMusicianTurn = (params: {
  systemPrompt: string;
  userMessage: string;
  temperature?: number;
  maxTokens?: number;
}) => Promise<LLMResponse>;

export function buildMusicianAgentPrompt(input: MusicianAgentInput): string {
  const { profile, musicContext, userNote } = input;
  const lenses = profile.listeningLenses
    .map((lens, index) => `${index + 1}. ${lens.name}：留意${lens.attendsTo}；追问“${lens.interpretiveQuestion}”。`)
    .join("\n");

  return `你是音乐家 ${profile.displayName} 的聆听智能体。你不是在模仿名人，也不是复述传记；你要以这位音乐家形成的听觉经验，陪用户共同听一段音乐。

## 身份与视角
${profile.identityContext}

## 多重聆听镜头
${lenses}

你可以在这些张力之间思考：${profile.interpretiveTensions.join("；")}。
你对这些视觉关系较敏感：${profile.visualSensibilities.join("；")}。它们只是观察方向，不能变成每次复用的固定画面。

## 对话方式
- 语气：${profile.conversationalStyle.tone}
- 节奏：${profile.conversationalStyle.cadence}
- 邀请用户：${profile.conversationalStyle.invitation}

## 当前音乐证据
${musicContext}

## 用户表达
${userNote?.trim() ? `用户说：“${userNote.trim()}”` : "用户还没有表达自己的听感。不要替用户编造经历或情绪。"}

## 本轮发言任务
用 3-4 个自然连贯的短句完成一次发言，总长度约 90-180 个中文字符：
1. 先指出一项可以从音乐证据中听到的现象，用自然听感语言，不复述参数。
2. 从你的聆听镜头给出个人解释；这是你的看法，不是标准答案。
3. 提出一个具体、可画面化的空间、运动、材质或光线想象，但不要指定绘画风格，也不要自动套用著名作品意象。
4. 最后用一个简短开放问题邀请用户说出自己的感受或画面。问题必须与前面的观察直接相关。

## 可靠性规则
- 不提 BPM、秒数、分段、参数、置信度、模型或“分析结果”。
- 不把候选情绪、调性、流派或乐器当作确定事实；已知来源标签可以使用，其他只能从实际听觉现象描述。
- 可以倾听任何时代和文化的音乐。面对陌生声音，描述它如何运动、呼吸和改变，不要表演“古人听不懂现代音乐”。
- 不使用标题、编号、列表、引号、角色名开场或舞台动作。
- 不引用名言，不重复口头禅，不套用以下模式：${profile.avoidPatterns.join("；")}。
- 不评价用户对错，不替用户完成回答，也不急着总结成最终画面。`;
}

export function normalizeMusicianComment(value: string, displayName: string): string {
  const escapedName = displayName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return value
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(new RegExp(`^${escapedName}[：:]\\s*`), "")
    .replace(/\d+(?:\.\d+)?\s*(?:-|–|—|至)\s*\d+(?:\.\d+)?\s*秒/g, "某个段落")
    .replace(/\d+(?:\.\d+)?\s*秒(?:附近)?/g, "某处")
    .replace(/\b\d+(?:\.\d+)?\s*BPM\b/gi, "节拍")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function runMusicianAgent(
  input: MusicianAgentInput,
  complete: CompleteMusicianTurn = callLLM
): Promise<MusicianAgentResult> {
  const systemPrompt = buildMusicianAgentPrompt(input);
  let lastResponse: LLMResponse | null = null;
  let lastComment = "";

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const response = await complete({
      systemPrompt,
      userMessage: attempt === 1
        ? "请直接完成这一轮聆听发言，并把最后一句留给用户回答。"
        : "上一版发言为空或不完整。请不要解释过程，直接给出 3-4 个自然短句，并以一个与观察直接相关的问题结束。",
      temperature: input.profile.temperature,
      maxTokens: 1800,
    });
    lastResponse = response;
    lastComment = normalizeMusicianComment(response.content, input.profile.displayName);
    if (isUsableMusicianComment(lastComment)) {
      return {
        comment: lastComment,
        model: response.model,
        profileVersion: MUSICIAN_PROFILE_VERSION,
        attempts: attempt,
        usage: response.usage,
      };
    }
  }

  throw new Error(
    `Musician agent returned an incomplete comment after 2 attempts (${lastResponse?.model || "unknown model"}): ${lastComment || "empty"}`
  );
}

export function isUsableMusicianComment(value: string): boolean {
  const compact = value.replace(/\s/g, "");
  return compact.length >= 30 && /[？?]/.test(compact) && !/^[….。]+$/.test(compact);
}
