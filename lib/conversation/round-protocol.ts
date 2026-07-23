import type {
  VisualBrief,
  VisualBriefFieldKey,
} from "../contracts/visual-brief.ts";
import {
  assessVisualBriefSlots,
  type VisualBriefSlotKey,
  type VisualBriefSlotStatus,
} from "../visual-brief/state.ts";

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
    question: "这个画面发生在哪里？最先出现的是什么？",
    starters: [],
  },
  "motion-composition": {
    question: "如果愿意，可以再说说画面里有什么在变化。",
    starters: [],
  },
  "light-color-material": {
    question: "这个画面最接近什么颜色、光线或质感？",
    starters: [],
  },
  "meaning-constraints": {
    question: "这幅画最想保留的感受是什么？",
    starters: [],
  },
};

const ROUND_GOALS = Object.keys(ROUND_GUIDANCE) as ConversationRoundGoal[];

const GOAL_FIELDS: Record<ConversationRoundGoal, VisualBriefFieldKey[]> = {
  "subject-space": ["subject", "space"],
  "motion-composition": ["motion", "composition"],
  "light-color-material": ["lighting", "palette", "materials", "atmosphere"],
  "meaning-constraints": ["personalMeaning", "mustInclude", "mustAvoid"],
};

const GOAL_SLOTS: Record<ConversationRoundGoal, VisualBriefSlotKey> = {
  "subject-space": "scene",
  "motion-composition": "dynamics",
  "light-color-material": "sensory",
  "meaning-constraints": "meaning",
};

const SLOT_GAP_SCORE: Record<VisualBriefSlotStatus, number> = {
  conflicted: 1.15,
  missing: 1,
  partial: 0.6,
  filled: 0,
};

export function goalForCompletedRounds(completedUserRounds: number): ConversationRoundGoal {
  return ROUND_GOALS[Math.min(Math.max(completedUserRounds, 0), ROUND_GOALS.length - 1)];
}

function fieldGapScore(brief: VisualBrief, key: VisualBriefFieldKey) {
  const status = brief.fields[key].status;
  if (status === "missing") return 1;
  if (status === "conflicted") return 0.85;
  if (status === "suggested") return 0.45;
  return 0;
}

export function goalForVisualBrief(
  brief: VisualBrief | null | undefined,
  completedUserRounds: number
): ConversationRoundGoal {
  if (!brief) return goalForCompletedRounds(completedUserRounds);

  const rotation = Math.min(Math.max(completedUserRounds, 0), ROUND_GOALS.length - 1);
  const slotStatus = new Map(
    assessVisualBriefSlots(brief.fields).map((slot) => [slot.key, slot.status])
  );
  return [...ROUND_GOALS]
    .sort((left, right) => {
      const leftSlotScore = SLOT_GAP_SCORE[slotStatus.get(GOAL_SLOTS[left]) || "missing"];
      const rightSlotScore = SLOT_GAP_SCORE[slotStatus.get(GOAL_SLOTS[right]) || "missing"];
      if (rightSlotScore !== leftSlotScore) return rightSlotScore - leftSlotScore;
      const leftFields = GOAL_FIELDS[left];
      const rightFields = GOAL_FIELDS[right];
      const leftScore = leftFields.reduce((total, key) => total + fieldGapScore(brief, key), 0) / leftFields.length;
      const rightScore = rightFields.reduce((total, key) => total + fieldGapScore(brief, key), 0) / rightFields.length;
      if (rightScore !== leftScore) return rightScore - leftScore;
      return (
        (ROUND_GOALS.indexOf(left) - rotation + ROUND_GOALS.length) % ROUND_GOALS.length
      ) - (
        (ROUND_GOALS.indexOf(right) - rotation + ROUND_GOALS.length) % ROUND_GOALS.length
      );
    })[0];
}
