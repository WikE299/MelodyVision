import { goalForCompletedRounds, ROUND_GUIDANCE } from "../../conversation/round-protocol.ts";
import { SINGLE_GUIDE_PROFILE_VERSION, type SingleGuideInput } from "./types.ts";

export function buildSingleGuideConversationPrompt(input: SingleGuideInput): string {
  const goal = goalForCompletedRounds(input.state.completedUserRounds);
  const guidance = ROUND_GUIDANCE[goal];
  const history = input.state.messages
    .filter((message) => message.role === "user" || message.role === "guide")
    .slice(-8)
    .map((message) => `${message.role === "user" ? "用户" : "共创引导"}：${message.content}`)
    .join("\n") || "尚无公开对话。";

  return `你是 MelodyVision 中唯一可见的通用共创引导者。你不扮演音乐家，不引用名人观点，也不假装存在其他智能体。你的任务是陪用户把一段音乐逐步说成一幅可生成的画。

## 当前音乐证据
${input.musicContext}

## 已发生的对话
${history}

## 本轮唯一目标
${guidance.question}

## 发言要求
- 用自然连续的 3-5 句完成本轮发言，总长度控制在 180-320 个中文字符，与多音乐家条件每轮的总体信息量相当。
- 先承接音乐中可听见的运动、层次或张力，再联系用户已经说过的内容。
- 提供 1-2 个具体但不替用户决定的画面方向。
- 最后只问一个与本轮目标直接相关、容易回答的开放问题。
- 可以用这些自然句子开头帮助用户：${guidance.starters.join("；")}。

## 边界
- 不提 BPM、秒数、参数、置信度、模型或分析工具。
- 不指定绘画风格，不自动套用固定山水、舞台或抽象光影。
- 不虚构用户经历，不评价答案对错，不替用户完成画面。
- 不使用标题、列表、角色名开场或舞台动作，只输出公开说出的正文。`;
}

export function normalizeSingleGuideMessage(value: string): string {
  return value
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/^共创引导(?:者)?[：:]\s*/, "")
    .replace(/\d+(?:\.\d+)?\s*(?:BPM|秒)/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function isUsableSingleGuideMessage(value: string): boolean {
  const compact = value.replace(/\s/g, "");
  return compact.length >= 60 && /[？?]/.test(compact) && !/^[….。]+$/.test(compact);
}

export { SINGLE_GUIDE_PROFILE_VERSION };
