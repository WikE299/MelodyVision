import assert from "node:assert/strict";
import test from "node:test";

import {
  createConversationState,
  recordMusicianMessage,
  recordUserMessage,
  requestGeneration,
  requestUserTurn,
  scheduleMusicianTurn,
} from "../lib/conversation/index.ts";
import {
  createDeterministicFacilitatorPlan,
  getEligibleSpeakerIds,
  runFacilitatorAgent,
} from "../lib/agents/facilitator/index.ts";

const musicianNames = {
  boya: "伯牙",
  beethoven: "贝多芬",
  abing: "阿炳",
  armstrong: "阿姆斯特朗",
};

function testRuntime() {
  let id = 0;
  let second = 0;
  return {
    createId: () => `id-${++id}`,
    now: () => `2026-07-11T00:00:${String(second++).padStart(2, "0")}.000Z`,
  };
}

function createFourPersonState() {
  return createConversationState(
    {
      id: "conversation-1",
      sessionId: "session-1",
      musicProfileId: "music-1",
      selectedMusicianIds: ["boya", "beethoven", "abing", "armstrong"],
    },
    testRuntime()
  );
}

test("conversation state requires one to four unique musicians", () => {
  assert.throws(
    () => createConversationState({
      sessionId: "session-1",
      musicProfileId: "music-1",
      selectedMusicianIds: ["boya", "boya"],
    }),
    /1-4 unique musicians/
  );
});

test("four-person opening schedules no more than two musicians and then yields to the user", () => {
  const runtime = testRuntime();
  const initial = createFourPersonState();
  const plan = createDeterministicFacilitatorPlan({ state: initial, musicianNames });
  assert.deepEqual(plan.speakerIds, ["boya", "beethoven"]);

  let state = scheduleMusicianTurn(initial, plan, runtime);
  state = recordMusicianMessage(state, { speakerId: "boya", content: "第一种听法。" }, runtime);
  assert.equal(state.turnOwner, "musicians");
  assert.deepEqual(state.queuedSpeakerIds, ["beethoven"]);

  state = recordMusicianMessage(state, { speakerId: "beethoven", content: "第二种听法。" }, runtime);
  assert.equal(state.turnOwner, "user");
  assert.equal(state.status, "awaiting-user");
  assert.equal(state.consecutiveMusicianMessages, 2);
  assert.equal(state.messages.at(-1)?.role, "facilitator");
  assert.equal(state.messages.at(-1)?.presentation, "stage-subtitle");
  assert.throws(
    () => recordMusicianMessage(state, { speakerId: "abing", content: "第三段。" }, runtime),
    /does not currently own/
  );
});

test("a single selected musician gets one turn before the user is invited", () => {
  const runtime = testRuntime();
  const state = createConversationState({
    sessionId: "session-1",
    musicProfileId: "music-1",
    selectedMusicianIds: ["boya"],
  }, runtime);
  const plan = createDeterministicFacilitatorPlan({ state, musicianNames });

  assert.deepEqual(plan.speakerIds, ["boya"]);
  const afterMessage = recordMusicianMessage(
    scheduleMusicianTurn(state, plan, runtime),
    { speakerId: "boya", content: "我先说一处。" },
    runtime
  );
  assert.equal(afterMessage.status, "awaiting-user");
});

test("the user can interrupt an active musician turn and immediately take ownership", () => {
  const runtime = testRuntime();
  const initial = createFourPersonState();
  const plan = createDeterministicFacilitatorPlan({ state: initial, musicianNames });
  const scheduled = scheduleMusicianTurn(initial, plan, runtime);
  const awaitingUser = requestUserTurn(scheduled, undefined, runtime);

  assert.equal(awaitingUser.turnOwner, "user");
  assert.deepEqual(awaitingUser.queuedSpeakerIds, []);

  const afterUser = recordUserMessage(awaitingUser, "我先想到一条向里收紧的路。", runtime);
  assert.equal(afterUser.turnOwner, "system");
  assert.equal(afterUser.completedUserRounds, 1);
  assert.equal(afterUser.consecutiveMusicianMessages, 0);
});

test("speaker eligibility favors musicians with fewer turns and avoids immediate repetition", () => {
  const runtime = testRuntime();
  const initial = createFourPersonState();
  const plan = createDeterministicFacilitatorPlan({ state: initial, musicianNames });
  let state = scheduleMusicianTurn(initial, plan, runtime);
  state = recordMusicianMessage(state, { speakerId: "boya", content: "第一段。" }, runtime);
  state = recordMusicianMessage(state, { speakerId: "beethoven", content: "第二段。" }, runtime);
  state = recordUserMessage(state, "我的画面更贴近地面。", runtime);

  assert.deepEqual(getEligibleSpeakerIds(state).slice(0, 2), ["abing", "armstrong"]);
  const nextPlan = createDeterministicFacilitatorPlan({ state, musicianNames });
  assert.equal(nextPlan.currentGoal, "motion-composition");
  assert.match(nextPlan.userInvitation, /动起来|靠近|散开|上升/);
});

test("the third completed user round converges and the final response becomes ready to generate", () => {
  const runtime = testRuntime();
  let state = createConversationState({
    sessionId: "session-1",
    musicProfileId: "music-1",
    selectedMusicianIds: ["boya"],
  }, runtime);

  for (let round = 1; round <= 3; round += 1) {
    const plan = createDeterministicFacilitatorPlan({ state, musicianNames });
    state = scheduleMusicianTurn(state, plan, runtime);
    state = recordMusicianMessage(state, { speakerId: "boya", content: `第${round}轮回应。` }, runtime);
    if (round < 3) {
      state = recordUserMessage(state, `第${round}轮用户表达。`, runtime);
    } else {
      state = recordUserMessage(state, "第三轮用户表达。", runtime);
      const finalPlan = createDeterministicFacilitatorPlan({ state, musicianNames });
      state = scheduleMusicianTurn(state, finalPlan, runtime);
      state = recordMusicianMessage(state, { speakerId: "boya", content: "最后回应。" }, runtime);
    }
  }

  assert.equal(state.completedUserRounds, 3);
  assert.equal(state.phase, "ready");
  assert.equal(state.status, "ready-to-generate");

  state = recordUserMessage(state, "生成前再补充一处颜色。", runtime);
  assert.equal(state.completedUserRounds, 3);
  assert.equal(state.phase, "ready");
  assert.equal(state.status, "ready-to-generate");
  assert.deepEqual(getEligibleSpeakerIds(state), []);
  assert.throws(() => requestUserTurn(state, undefined, runtime), /no longer has/);
});

test("generation can be requested early without completing all rounds", () => {
  const runtime = testRuntime();
  const state = requestGeneration(createFourPersonState(), runtime);
  assert.equal(state.phase, "ready");
  assert.equal(state.status, "ready-to-generate");
});

test("facilitator model plans are constrained to eligible speakers", async () => {
  const state = createFourPersonState();
  const valid = await runFacilitatorAgent(
    { state, musicianNames },
    async () => ({
      content: JSON.stringify({
        speakerIds: ["beethoven", "abing"],
        transition: "刚才的画面还很开阔，接下来探索 motion-composition。",
        userInvitation: "你更靠近哪一种，又看见了什么？",
        sentenceStarters: ["我最先看见……", "它像是在……"],
      }),
      model: "test-model",
    })
  );
  assert.equal(valid.source, "model");
  assert.equal(valid.model, "test-model");
  assert.equal(valid.stageSubtitle, "刚才的画面还很开阔，接下来探索 画面的运动。");
  assert.equal(valid.currentGoal, "subject-space");
  assert.deepEqual(valid.sentenceStarters, ["我最先看见……", "它像是在……"]);

  const invalid = await runFacilitatorAgent(
    { state, musicianNames },
    async () => ({
      content: JSON.stringify({
        speakerIds: ["lennon", "tandun", "mozart"],
        userInvitation: "回答。",
      }),
      model: "test-model",
    })
  );
  assert.equal(invalid.source, "deterministic-fallback");
  assert.deepEqual(invalid.speakerIds, ["boya", "beethoven"]);
});
