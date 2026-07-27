import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createConversationState, startUserFirstConversation } from "../lib/conversation/index.ts";
import { createRecoveryFacilitatorPlan } from "../lib/conversation/recovery-plan.ts";
import { createEmptyVisualBrief } from "../lib/visual-brief/state.ts";

function runtime() {
  let id = 0;
  return {
    createId: () => `recovery-${++id}`,
    now: () => "2026-07-27T00:00:00.000Z",
  };
}

test("recovery plan preserves a pending multi-agent queue", () => {
  const state = createConversationState({
    id: "conversation-recovery",
    trialId: "trial-recovery",
    sessionId: "session-recovery",
    musicProfileId: "music-recovery",
    condition: "multi_agent",
    selectedMusicianIds: ["boya", "beethoven"],
  }, runtime());
  const queuedState = {
    ...state,
    status: "streaming-musician" as const,
    turnOwner: "musicians" as const,
    queuedSpeakerIds: ["beethoven"],
  };

  const plan = createRecoveryFacilitatorPlan(queuedState, null);
  assert.deepEqual(plan.speakerIds, ["beethoven"]);
  assert.match(plan.stageSubtitle, /继续听完/);
});

test("recovery plan restores the reflective guide for single-agent sessions", () => {
  const initial = createConversationState({
    id: "conversation-single-recovery",
    trialId: "trial-single-recovery",
    sessionId: "session-single-recovery",
    musicProfileId: "music-single-recovery",
    condition: "single_agent",
    selectedMusicianIds: ["boya", "beethoven"],
    guideId: "co-creation-guide",
  }, runtime());
  const state = startUserFirstConversation(initial, runtime());
  const brief = createEmptyVisualBrief({
    conversationId: state.id,
    musicProfileId: state.musicProfileId,
  });

  const plan = createRecoveryFacilitatorPlan(state, brief);
  assert.equal(plan.speakerIds.length, 0);
  assert.ok(plan.userInvitation.length > 0);
});

test("database recovery returns the latest conversation and visual brief", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "melodyvision-recovery-"));
  process.env.MELODYVISION_DATA_DIR = directory;
  try {
    const researchData = await import("../lib/db/research-data.ts");
    const state = startUserFirstConversation(createConversationState({
      id: "conversation-db-recovery",
      trialId: "trial-db-recovery",
      sessionId: "session-db-recovery",
      musicProfileId: "music-db-recovery",
      condition: "multi_agent",
      selectedMusicianIds: ["boya"],
    }, runtime()), runtime());
    const brief = createEmptyVisualBrief({
      conversationId: state.id,
      musicProfileId: state.musicProfileId,
    });

    await researchData.insertConversationSnapshot(state, "test recovery");
    await researchData.insertVisualBriefVersion({
      trialId: state.trialId,
      sessionId: state.sessionId,
      brief,
    });

    const recovered = await researchData.getConversationRecoveryForTrial(state.trialId);
    assert.equal(recovered?.state.id, state.id);
    assert.equal(recovered?.state.status, "awaiting-user");
    assert.equal(recovered?.visualBrief?.id, brief.id);
  } finally {
    await rm(directory, { recursive: true, force: true });
    delete process.env.MELODYVISION_DATA_DIR;
  }
});
