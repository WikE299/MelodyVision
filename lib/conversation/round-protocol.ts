export type ConversationRoundGoal =
  | "subject-space"
  | "motion-composition"
  | "light-color-material"
  | "meaning-constraints";

export interface RoundGuidance {
  question: string;
  starters: string[];
}

export const ROUND_GUIDANCE: Record<ConversationRoundGoal, RoundGuidance> = {
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

const ROUND_GOALS = Object.keys(ROUND_GUIDANCE) as ConversationRoundGoal[];

export function goalForCompletedRounds(completedUserRounds: number): ConversationRoundGoal {
  return ROUND_GOALS[Math.min(Math.max(completedUserRounds, 0), ROUND_GOALS.length - 1)];
}
