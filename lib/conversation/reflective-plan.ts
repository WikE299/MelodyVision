import {
  FACILITATOR_PROFILE_VERSION,
  type FacilitatorPlan,
} from "../agents/facilitator/types.ts";
import type { ConversationState } from "../contracts/conversation-state.ts";
import { goalForCompletedRounds, ROUND_GUIDANCE } from "./round-protocol.ts";

export function createReflectivePlan(state: ConversationState): FacilitatorPlan {
  const goal = goalForCompletedRounds(state.completedUserRounds);
  const guidance = ROUND_GUIDANCE[goal];
  return {
    speakerIds: [],
    stageSubtitle: state.completedUserRounds === 0
      ? "听听不同视角，再写下属于你自己的画面。"
      : state.completedUserRounds >= state.turnPolicy.maxUserRounds
        ? "四处画面札记已经完整，可以生成画作了。"
        : "刚才的画面已经记下，继续靠近下一层。",
    userInvitation: guidance.question,
    currentGoal: goal,
    sentenceStarters: guidance.starters,
    source: "deterministic-fallback",
    profileVersion: FACILITATOR_PROFILE_VERSION,
  };
}
