import assert from "node:assert/strict";
import test from "node:test";

import {
  runVisualScribeAgent,
  validateVisualScribeDraft,
  type VisualScribeDraft,
  type VisualScribeInput,
} from "../lib/agents/visual-scribe/index.ts";
import {
  createConversationState,
  recordMusicianMessage,
  recordUserMessage,
  scheduleMusicianTurn,
} from "../lib/conversation/index.ts";
import {
  assessVisualBriefSlots,
  calculateVisualBriefReadiness,
  createEmptyVisualBrief,
  parseVisualBrief,
} from "../lib/visual-brief/index.ts";

function runtime() {
  let id = 0;
  return {
    createId: () => `scribe-id-${++id}`,
    now: () => "2026-07-11T00:00:00.000Z",
  };
}

function scribeFixture() {
  const clock = runtime();
  let state = createConversationState({
    id: "conversation-scribe",
    sessionId: "session-scribe",
    musicProfileId: "music-scribe",
    selectedMusicianIds: ["boya"],
  }, clock);
  state = scheduleMusicianTurn(state, {
    speakerIds: ["boya"],
    stageSubtitle: "先听伯牙。",
    userInvitation: "你看见了什么？",
  }, clock);
  state = recordMusicianMessage(state, {
    speakerId: "boya",
    content: "余音像贴着地面延伸的细线，边缘带着轻微颤动。",
  }, clock);
  state = recordUserMessage(
    state,
    "我看见一条向远方收紧的黑色道路，尽头必须有一道斜光。",
    clock
  );
  const musicianMessage = state.messages.find((message) => message.role === "musician")!;
  const userMessage = state.messages.find((message) => message.role === "user")!;
  return { state, musicianMessage, userMessage };
}

function validDraft(musicianId: string, userId: string): VisualScribeDraft {
  return {
    fields: {
      subject: { value: "一条向远方收紧的黑色道路", status: "confirmed", sourceIds: [userId] },
      space: { value: "道路通向远方的压缩空间", status: "confirmed", sourceIds: [userId] },
      composition: { value: "道路形成向中心收束的斜向构图", status: "suggested", sourceIds: [userId, musicianId] },
      motion: { value: ["贴地延伸", "向远方收紧"], status: "confirmed", sourceIds: [userId, musicianId] },
      materials: { value: ["细线般的纤维边缘"], status: "suggested", sourceIds: [musicianId] },
      palette: { value: ["黑色"], status: "confirmed", sourceIds: [userId] },
      lighting: { value: "尽头的一道斜光", status: "confirmed", sourceIds: [userId] },
      atmosphere: { value: ["克制", "持续颤动"], status: "suggested", sourceIds: [musicianId] },
      personalMeaning: { value: "用户关注受压后仍向前延伸的力量", status: "confirmed", sourceIds: [userId] },
      mustInclude: { value: ["黑色道路", "尽头斜光"], status: "confirmed", sourceIds: [userId] },
      mustAvoid: { value: null, status: "missing", sourceIds: [] },
    },
  };
}

test("visual scribe creates a traceable ready brief from user and musician evidence", async () => {
  const { state, musicianMessage, userMessage } = scribeFixture();
  const draft = validDraft(musicianMessage.id, userMessage.id);
  const result = await runVisualScribeAgent(
    { conversationState: state, musicContext: "动态逐渐增强。" },
    async () => ({ content: JSON.stringify(draft), model: "test-model" })
  );

  assert.equal(result.fallback, false);
  assert.equal(result.attempts, 1);
  assert.equal(result.brief.version, 1);
  assert.equal(result.brief.status, "ready");
  assert.equal(result.brief.readiness.ready, true);
  assert.equal(result.brief.fields.subject.status, "confirmed");
  assert.equal(result.brief.fields.subject.sources[0].kind, "user-message");
  assert.equal(result.brief.fields.materials.sources[0].kind, "musician-message");
});

test("an abstract scene can be ready without a literal subject", () => {
  const fields = createEmptyVisualBrief({
    conversationId: "abstract-conversation",
    musicProfileId: "abstract-music",
  }).fields;
  fields.space = { value: "没有边界的远距离空间", status: "confirmed", sources: [] };
  fields.motion = { value: ["缓慢向外扩张"], status: "confirmed", sources: [] };
  fields.lighting = { value: "中心冷光逐渐退去", status: "confirmed", sources: [] };
  fields.atmosphere = { value: ["失重", "安静"], status: "confirmed", sources: [] };
  fields.personalMeaning = { value: "希望保留失重与疏离感", status: "confirmed", sources: [] };

  const readiness = calculateVisualBriefReadiness(fields);
  const slots = assessVisualBriefSlots(fields);
  assert.equal(readiness.ready, true);
  assert.equal(readiness.missingFields.includes("subject"), true);
  assert.equal(slots.every((slot) => slot.status === "filled"), true);
});

test("a sparse feeling receives one targeted follow-up instead of false readiness", () => {
  const fields = createEmptyVisualBrief({
    conversationId: "sparse-conversation",
    musicProfileId: "sparse-music",
  }).fields;
  fields.space = { value: "离我很远", status: "confirmed", sources: [] };
  fields.atmosphere = { value: ["悲伤"], status: "confirmed", sources: [] };
  fields.personalMeaning = { value: "这段悲伤离我很近", status: "confirmed", sources: [] };

  const readiness = calculateVisualBriefReadiness(fields);
  const slots = assessVisualBriefSlots(fields);
  assert.equal(readiness.ready, false);
  assert.equal(slots.find((slot) => slot.key === "dynamics")?.status, "missing");
  assert.equal(slots.find((slot) => slot.key === "sensory")?.status, "missing");
  assert.equal(slots.filter((slot) => slot.status === "filled").length, 2);
  assert.match(readiness.reasons.join(" "), /变化与画面关系、光色与质地/);
});

test("musician or music suggestions do not fill a user evidence slot", () => {
  const fields = createEmptyVisualBrief({
    conversationId: "suggested-conversation",
    musicProfileId: "suggested-music",
  }).fields;
  fields.subject = { value: "远处的一道人影", status: "confirmed", sources: [] };
  fields.motion = { value: ["向外扩散"], status: "suggested", sources: [] };
  fields.lighting = { value: "冷光", status: "suggested", sources: [] };
  fields.personalMeaning = { value: "不想丢掉疏离感", status: "confirmed", sources: [] };

  const slots = assessVisualBriefSlots(fields);
  assert.equal(slots.find((slot) => slot.key === "scene")?.status, "filled");
  assert.equal(slots.find((slot) => slot.key === "dynamics")?.status, "partial");
  assert.equal(slots.find((slot) => slot.key === "sensory")?.status, "partial");
  assert.equal(slots.find((slot) => slot.key === "meaning")?.status, "filled");
  assert.equal(calculateVisualBriefReadiness(fields).ready, false);
});

test("visual scribe repairs a confirmed field that lacks user evidence", async () => {
  const { state, musicianMessage, userMessage } = scribeFixture();
  const invalid = validDraft(musicianMessage.id, userMessage.id);
  invalid.fields.subject.sourceIds = [musicianMessage.id];
  let calls = 0;
  const result = await runVisualScribeAgent(
    { conversationState: state, musicContext: "动态逐渐增强。" },
    async () => {
      calls += 1;
      return {
        content: JSON.stringify(calls === 1 ? invalid : validDraft(musicianMessage.id, userMessage.id)),
        model: "test-model",
      };
    }
  );

  assert.equal(calls, 2);
  assert.equal(result.attempts, 2);
  assert.equal(result.fallback, false);
});

test("visual scribe falls back to traceable user evidence after repeated invalid sources", async () => {
  const { state, musicianMessage, userMessage } = scribeFixture();
  const invalid = validDraft(musicianMessage.id, userMessage.id);
  invalid.fields.lighting.sourceIds = ["invented-message"];
  const result = await runVisualScribeAgent(
    { conversationState: state, musicContext: "动态逐渐增强。" },
    async () => ({ content: JSON.stringify(invalid), model: "test-model" })
  );

  assert.equal(result.fallback, true);
  assert.equal(result.brief.version, 1);
  assert.equal(result.brief.fields.subject.status, "confirmed");
  assert.equal(result.brief.fields.subject.sources[0].sourceId, userMessage.id);
  assert.equal(result.brief.fields.personalMeaning.status, "confirmed");
  assert.equal(result.brief.fields.personalMeaning.value, userMessage.content);
  assert.equal(result.brief.fields.personalMeaning.sources[0].sourceId, userMessage.id);
  assert.equal(result.brief.readiness.ready, true);
  assert.match(result.validationErrors.join(" "), /unknown sourceIds/);
});

test("visual scribe fallback extracts explicit cues across free-form messages", async () => {
  const fixture = scribeFixture();
  const clock = runtime();
  let state = scheduleMusicianTurn(fixture.state, {
    speakerIds: ["boya"],
    stageSubtitle: "继续听动势。",
    userInvitation: "它怎样移动？",
  }, clock);
  state = recordMusicianMessage(state, {
    speakerId: "boya",
    content: "道路正在向远处收紧。",
  }, clock);
  state = recordUserMessage(state, "道路从左下向右上快速抬升。", clock);

  const result = await runVisualScribeAgent(
    { conversationState: state, musicContext: "动态逐渐增强。" },
    async () => ({ content: "not-json", model: "test-model" })
  );

  assert.equal(result.fallback, true);
  assert.equal(result.brief.fields.subject.status, "confirmed");
  assert.equal(result.brief.fields.composition.status, "confirmed");
  assert.equal(result.brief.fields.motion.status, "confirmed");
  assert.equal(result.brief.fields.personalMeaning.status, "confirmed");
  assert.match(String(result.brief.fields.personalMeaning.value), /黑色道路/);
  assert.match(String(result.brief.fields.personalMeaning.value), /快速抬升/);
});

test("music analysis alone cannot create a visual subject", () => {
  const { state, musicianMessage, userMessage } = scribeFixture();
  const draft = validDraft(musicianMessage.id, userMessage.id);
  draft.fields.subject = {
    value: "一座山",
    status: "suggested",
    sourceIds: ["music-profile"],
  };
  const errors = validateVisualScribeDraft(draft, {
    conversationState: state,
    musicContext: "动态逐渐增强。",
  });
  assert.match(errors.join(" "), /subject cannot be created from music analysis alone/);
});

test("a confirmed value cannot change without a new user message", async () => {
  const { state, musicianMessage, userMessage } = scribeFixture();
  const initialDraft = validDraft(musicianMessage.id, userMessage.id);
  const initial = await runVisualScribeAgent(
    { conversationState: state, musicContext: "动态逐渐增强。" },
    async () => ({ content: JSON.stringify(initialDraft), model: "test-model" })
  );
  const changed = validDraft(musicianMessage.id, userMessage.id);
  changed.fields.subject.value = "一座没有来源的白塔";
  const input: VisualScribeInput = {
    conversationState: state,
    previousBrief: initial.brief,
    musicContext: "动态逐渐增强。",
  };
  const errors = validateVisualScribeDraft(changed, input);
  assert.match(errors.join(" "), /cannot change a confirmed value without new user evidence/);
});

test("malformed previous briefs are rejected before the fallback path can use them", async () => {
  const { state, musicianMessage, userMessage } = scribeFixture();
  const initial = await runVisualScribeAgent(
    { conversationState: state, musicContext: "动态逐渐增强。" },
    async () => ({
      content: JSON.stringify(validDraft(musicianMessage.id, userMessage.id)),
      model: "test-model",
    })
  );
  const malformed = {
    ...initial.brief,
    fields: {
      ...initial.brief.fields,
      subject: { status: "confirmed", value: 42, sources: [] },
    },
  };
  assert.equal(parseVisualBrief(malformed), null);
});
