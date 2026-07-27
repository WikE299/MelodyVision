import {
  createDeterministicFacilitatorPlan,
  getEligibleSpeakerIds,
} from "../agents/facilitator/runner.ts";
import {
  FACILITATOR_PROFILE_VERSION,
  type FacilitatorPlan,
} from "../agents/facilitator/types.ts";
import type { ConversationState } from "../contracts/conversation-state.ts";
import type { VisualBrief } from "../contracts/visual-brief.ts";
import { goalForVisualBrief, ROUND_GUIDANCE } from "./round-protocol.ts";
import { createReflectivePlan } from "./reflective-plan.ts";

export function createRecoveryFacilitatorPlan(
  state: ConversationState,
  visualBrief: VisualBrief | null
): FacilitatorPlan {
  if (state.condition === "single_agent") {
    return createReflectivePlan(state, visualBrief);
  }

  if (
    state.turnOwner === "system" &&
    state.status === "idle" &&
    getEligibleSpeakerIds(state).length > 0
  ) {
    return createDeterministicFacilitatorPlan({
      state,
      visualBrief,
      musicianNames: Object.fromEntries(
        state.selectedMusicianIds.map((id) => [id, id])
      ),
    });
  }

  const goal = goalForVisualBrief(visualBrief, state.completedUserRounds);
  const ready = Boolean(visualBrief?.readiness.ready);
  return {
    speakerIds: [...state.queuedSpeakerIds],
    stageSubtitle: state.queuedSpeakerIds.length > 0
      ? "继续听完这一轮回应，随后再由你决定画面。"
      : ready
        ? "画面线索已经聚拢，可以进入生成。"
        : "沿着刚才的画面继续，不需要重新开始。",
    userInvitation: ready
      ? "这些线索已经可以形成画面。"
      : ROUND_GUIDANCE[goal].question,
    currentGoal: goal,
    sentenceStarters: [],
    source: "deterministic-fallback",
    profileVersion: FACILITATOR_PROFILE_VERSION,
  };
}
