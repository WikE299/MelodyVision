import assert from "node:assert/strict";
import test from "node:test";

import {
  canConvergeFromUserEvidence,
  continueReflectiveListening,
  createConversationState,
  recordMusicianMessage,
  recordReflectiveComment,
  recordUserMessage,
  requestGeneration,
  requestUserTurn,
  scheduleMusicianTurn,
  startReflectiveListening,
  startUserFirstConversation,
} from "../lib/conversation/index.ts";
import {
  createDeterministicFacilitatorPlan,
  getEligibleSpeakerIds,
  runFacilitatorAgent,
} from "../lib/agents/facilitator/index.ts";
import { goalForVisualBrief } from "../lib/conversation/round-protocol.ts";
import { createEmptyVisualBrief } from "../lib/visual-brief/state.ts";

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

function withMusicianCoverage(state: ReturnType<typeof createFourPersonState>) {
  return {
    ...state,
    musicianMemory: Object.fromEntries(
      state.selectedMusicianIds.map((musicianId) => [
        musicianId,
        {
          ...state.musicianMemory[musicianId],
          publicTurnCount: 1,
        },
      ])
    ),
  };
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

test("new listening sessions give the first turn to the user", () => {
  const runtime = testRuntime();
  const started = startUserFirstConversation(createFourPersonState(), runtime);

  assert.equal(started.phase, "opening");
  assert.equal(started.status, "awaiting-user");
  assert.equal(started.turnOwner, "user");
  assert.deepEqual(started.queuedSpeakerIds, []);

  const afterUser = recordUserMessage(started, "很空，像声音没有边界。", runtime);
  assert.equal(afterUser.completedUserRounds, 1);
  assert.equal(afterUser.turnOwner, "system");
});

test("the next internal goal follows missing brief fields instead of a fixed visible questionnaire", () => {
  const brief = createEmptyVisualBrief({
    conversationId: "conversation-adaptive",
    musicProfileId: "music-adaptive",
  });
  brief.fields.subject = {
    value: "无边界的回声",
    status: "confirmed",
    sources: [],
  };
  brief.fields.space = {
    value: "向外扩张的空处",
    status: "confirmed",
    sources: [],
  };

  assert.equal(goalForVisualBrief(brief, 0), "motion-composition");
});

test("four-person opening schedules every selected musician before yielding to the user", () => {
  const runtime = testRuntime();
  const initial = createFourPersonState();
  const plan = createDeterministicFacilitatorPlan({ state: initial, musicianNames });
  assert.deepEqual(plan.speakerIds, ["boya", "beethoven", "abing", "armstrong"]);

  let state = scheduleMusicianTurn(initial, plan, runtime);
  for (const musicianId of initial.selectedMusicianIds) {
    state = recordMusicianMessage(
      state,
      { speakerId: musicianId, content: `${musicianNames[musicianId as keyof typeof musicianNames]}的听法。` },
      runtime
    );
  }
  assert.equal(state.turnOwner, "user");
  assert.equal(state.status, "awaiting-user");
  assert.equal(state.consecutiveMusicianMessages, 4);
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
  const initial = createConversationState(
    {
      id: "conversation-coverage-order",
      sessionId: "session-coverage-order",
      musicProfileId: "music-coverage-order",
      selectedMusicianIds: ["boya", "beethoven", "abing", "armstrong"],
      turnPolicy: {
        maxConsecutiveMusicianMessages: 2,
        maxMusiciansPerResponse: 2,
      },
    },
    runtime
  );
  const plan = createDeterministicFacilitatorPlan({ state: initial, musicianNames });
  let state = scheduleMusicianTurn(initial, plan, runtime);
  state = recordMusicianMessage(state, { speakerId: "boya", content: "第一段。" }, runtime);
  state = recordMusicianMessage(state, { speakerId: "beethoven", content: "第二段。" }, runtime);
  state = recordUserMessage(state, "我的画面更贴近地面。", runtime);

  assert.deepEqual(getEligibleSpeakerIds(state).slice(0, 2), ["abing", "armstrong"]);
  const nextPlan = createDeterministicFacilitatorPlan({ state, musicianNames });
  assert.equal(nextPlan.currentGoal, "motion-composition");
  assert.equal(nextPlan.userInvitation, "如果愿意，可以再说说画面里有什么在变化。");
});

test("one free expression and one targeted follow-up are the maximum user input", () => {
  const runtime = testRuntime();
  let state = createConversationState({
    sessionId: "session-1",
    musicProfileId: "music-1",
    selectedMusicianIds: ["boya"],
  }, runtime);

  for (let round = 1; round <= 2; round += 1) {
    const plan = createDeterministicFacilitatorPlan({ state, musicianNames });
    state = scheduleMusicianTurn(state, plan, runtime);
    state = recordMusicianMessage(state, { speakerId: "boya", content: `第${round}轮回应。` }, runtime);
    if (round < 2) {
      state = recordUserMessage(state, `第${round}轮用户表达。`, runtime);
    } else {
      state = recordUserMessage(state, "针对缺口补充一次。", runtime);
      const finalPlan = createDeterministicFacilitatorPlan({ state, musicianNames });
      state = scheduleMusicianTurn(state, finalPlan, runtime);
      state = recordMusicianMessage(state, { speakerId: "boya", content: "最后回应。" }, runtime);
    }
  }

  assert.equal(state.completedUserRounds, 2);
  assert.equal(state.phase, "ready");
  assert.equal(state.status, "ready-to-generate");

  state = recordUserMessage(state, "生成前再补充一处颜色。", runtime);
  assert.equal(state.completedUserRounds, 2);
  assert.equal(state.phase, "ready");
  assert.equal(state.status, "ready-to-generate");
  assert.deepEqual(getEligibleSpeakerIds(state), []);
  assert.throws(() => requestUserTurn(state, undefined, runtime), /no longer has/);
});

test("multi-agent slot clarification may continue beyond two inputs but still converges early", () => {
  const runtime = testRuntime();
  let state = createConversationState({
    sessionId: "session-adaptive-slots",
    musicProfileId: "music-adaptive-slots",
    selectedMusicianIds: ["boya"],
    turnPolicy: {
      maxUserRounds: 4,
      userMayGenerateEarly: false,
    },
  }, runtime);

  state = recordUserMessage(state, "我只看见远处一个人。", runtime);
  assert.equal(state.phase, "exploration");
  state = recordUserMessage(
    { ...state, status: "awaiting-user", turnOwner: "user" },
    "他正在缓慢向海面靠近。",
    runtime
  );

  assert.equal(state.completedUserRounds, 2);
  assert.equal(state.phase, "exploration");
  assert.throws(() => requestGeneration(state, runtime), /not ready to generate/);

  const converged = { ...state, phase: "ready" as const };
  assert.doesNotThrow(() =>
    requestGeneration(
      {
        ...converged,
        musicianMemory: {
          boya: { musicianId: "boya", publicTurnCount: 1 },
        },
      },
      runtime
    )
  );
});

test("a sufficiently rich free expression converges only after every selected musician responds", () => {
  const runtime = testRuntime();
  let state = startUserFirstConversation(createFourPersonState(), runtime);
  state = recordUserMessage(
    state,
    "我看见一片向外扩张的暗色空间，光从中心缓慢退去，这种失重感必须保留。",
    runtime
  );
  state = { ...state, phase: "convergence" };
  const plan = createDeterministicFacilitatorPlan({ state, musicianNames });
  assert.deepEqual(plan.speakerIds, ["boya", "beethoven", "abing", "armstrong"]);
  state = scheduleMusicianTurn(state, plan, runtime);
  while (state.turnOwner === "musicians") {
    state = recordMusicianMessage(state, {
      speakerId: state.queuedSpeakerIds[0],
      content: "我沿着你说的失重感，再听见光线向外退开的呼吸。",
    }, runtime);
  }

  assert.equal(state.completedUserRounds, 1);
  assert.equal(state.phase, "ready");
  assert.equal(state.status, "ready-to-generate");
});

test("generation cannot be requested before the visual conversation converges", () => {
  const runtime = testRuntime();
  assert.throws(
    () => requestGeneration(createFourPersonState(), runtime),
    /not ready to generate/
  );
});

test("generation is blocked until every selected musician has contributed", () => {
  const runtime = testRuntime();
  const state = {
    ...createFourPersonState(),
    phase: "ready" as const,
    status: "ready-to-generate" as const,
    turnOwner: "user" as const,
    musicianMemory: {
      ...createFourPersonState().musicianMemory,
      boya: { musicianId: "boya", publicTurnCount: 1 },
      beethoven: { musicianId: "beethoven", publicTurnCount: 1 },
    },
  };

  assert.throws(
    () => requestGeneration(state, runtime),
    /All selected musicians must contribute/
  );
});

test("multi-agent conversations may generate early only after two user rounds", () => {
  const runtime = testRuntime();
  let state = createConversationState({
    sessionId: "session-early",
    musicProfileId: "music-early",
    selectedMusicianIds: ["boya"],
    turnPolicy: { userMayGenerateEarly: true },
  }, runtime);

  assert.throws(() => requestGeneration(state, runtime), /not ready to generate/);
  for (let round = 1; round <= 2; round += 1) {
    const plan = createDeterministicFacilitatorPlan({ state, musicianNames });
    state = scheduleMusicianTurn(state, plan, runtime);
    state = recordMusicianMessage(state, { speakerId: "boya", content: `第${round}轮回应。` }, runtime);
    state = recordUserMessage(state, `第${round}轮用户表达。`, runtime);
  }

  const ready = requestGeneration(state, runtime);
  assert.equal(ready.status, "ready-to-generate");
  assert.equal(ready.completedUserRounds, 2);
});

test("multi-agent conversations converge after two user rounds when the visual brief is ready", () => {
  const runtime = testRuntime();
  let state = createConversationState({
    sessionId: "session-converged",
    musicProfileId: "music-converged",
    selectedMusicianIds: ["boya", "beethoven"],
    turnPolicy: { userMayGenerateEarly: true },
  }, runtime);

  state = scheduleMusicianTurn(state, {
    ...createDeterministicFacilitatorPlan({ state, musicianNames }),
    speakerOrder: ["boya", "beethoven"],
  }, runtime);
  state = recordMusicianMessage(state, { speakerId: "boya", content: "第一位回应。" }, runtime);
  state = recordMusicianMessage(state, { speakerId: "beethoven", content: "第二位回应。" }, runtime);
  state = recordUserMessage(state, "第一轮用户表达。", runtime);
  state = scheduleMusicianTurn(state, {
    ...createDeterministicFacilitatorPlan({ state, musicianNames }),
    speakerOrder: ["boya"],
  }, runtime);
  state = recordMusicianMessage(state, { speakerId: "boya", content: "收束回应。" }, runtime);
  state = recordUserMessage(state, "第二轮用户补充。", runtime);

  assert.equal(canConvergeFromUserEvidence(state, false), false);
  assert.equal(canConvergeFromUserEvidence(state, true), true);
  assert.equal(requestGeneration(state, runtime).status, "ready-to-generate");
});

test("reflective listening records independent comments with at most two user notes", () => {
  const runtime = testRuntime();
  let state = createConversationState({
    trialId: "trial-single",
    sessionId: "session-single",
    musicProfileId: "music-single",
    selectedMusicianIds: ["boya", "beethoven"],
    condition: "single_agent",
    guideId: "co_creation_guide",
  }, runtime);

  state = startReflectiveListening(state, runtime);
  state = recordReflectiveComment(state, {
    speakerId: "boya",
    content: "我听见声音在空处缓慢展开，像远山之间留下的一线回声。",
  }, runtime);
  state = recordReflectiveComment(state, {
    speakerId: "beethoven",
    content: "短小的力量不断向前推进，画面的重心因此持续移动。",
  }, runtime);

  for (let round = 1; round <= 2; round += 1) {
    state = recordUserMessage(state, `第${round}轮用户画面。`, runtime);
    state = continueReflectiveListening(state, runtime);
  }

  assert.equal(state.completedUserRounds, 2);
  assert.equal(state.status, "ready-to-generate");
  assert.equal(state.messages.filter((message) => message.role === "guide").length, 0);
  assert.equal(state.messages.filter((message) => message.role === "musician").length, 2);
  assert.equal(state.messages.filter((message) => message.role === "user").length, 2);
  assert.throws(
    () => recordReflectiveComment(state, { speakerId: "boya", content: "重复点评。" }, runtime),
    /already contributed/
  );
});

test("facilitator model plans are constrained to eligible speakers", async () => {
  const state = withMusicianCoverage(createFourPersonState());
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
  assert.equal(
    valid.userInvitation,
    "这个画面发生在哪里？最先出现的是什么？"
  );
  assert.deepEqual(valid.sentenceStarters, []);

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

test("facilitator rejects an identity-confused Armstrong plan", async () => {
  const state = withMusicianCoverage(createFourPersonState());
  const plan = await runFacilitatorAgent(
    { state, musicianNames },
    async () => ({
      content: JSON.stringify({
        speakerIds: ["armstrong"],
        transition: "从月球回望地球，我们继续听这一段。",
        userInvitation: "你看见了什么？",
        sentenceStarters: ["我最先看见……", "它像是在……"],
      }),
      model: "test-model",
    })
  );

  assert.equal(plan.source, "deterministic-fallback");
  assert.deepEqual(plan.speakerIds, ["boya", "beethoven"]);
});
