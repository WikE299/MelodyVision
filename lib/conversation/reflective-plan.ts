import {
  FACILITATOR_PROFILE_VERSION,
  type FacilitatorPlan,
} from "../agents/facilitator/types.ts";
import type { ConversationState } from "../contracts/conversation-state.ts";
import type { VisualBrief } from "../contracts/visual-brief.ts";
import { goalForVisualBrief, ROUND_GUIDANCE } from "./round-protocol.ts";

export function createReflectivePlan(
  state: ConversationState,
  visualBrief?: VisualBrief | null
): FacilitatorPlan {
  const goal = goalForVisualBrief(visualBrief, state.completedUserRounds);
  const guidance = ROUND_GUIDANCE[goal];
  const isOpening = state.completedUserRounds === 0;
  return {
    speakerIds: [],
    stageSubtitle: isOpening
      ? "先由你定下这幅画的起点，音乐家会沿着你的感受继续听。"
      : state.completedUserRounds >= state.turnPolicy.maxUserRounds
        ? "画面线索已经聚拢，可以生成画作了。"
        : visualBrief?.readiness.ready
          ? "你的画面已经足够清晰，可以直接生成画作。"
          : "刚才的画面已经记下，只沿着还模糊的一处继续。",
    userInvitation: isOpening
      ? "此刻，这段音乐让你想到什么？"
      : guidance.question,
    currentGoal: goal,
    sentenceStarters: [],
    source: "deterministic-fallback",
    profileVersion: FACILITATOR_PROFILE_VERSION,
  };
}
