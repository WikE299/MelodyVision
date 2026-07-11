import assert from "node:assert/strict";
import test from "node:test";

import { characters } from "../lib/characters/index.ts";
import type { MusicProfile } from "../lib/contracts/index.ts";
import {
  createConversationState,
  recordMusicianMessage,
  recordUserMessage,
  scheduleMusicianTurn,
} from "../lib/conversation/index.ts";
import { runVisualScribeAgent } from "../lib/agents/visual-scribe/index.ts";
import {
  buildPromptDirectorInput,
  buildPromptDirectorInstruction,
} from "../lib/prompts/image-gen.ts";

function runtime() {
  let id = 0;
  return {
    createId: () => `prompt-v2-${++id}`,
    now: () => "2026-07-11T00:00:00.000Z",
  };
}

test("Version 2 prompt input preserves VisualBrief fields and exact source references", async () => {
  const clock = runtime();
  let state = createConversationState({
    id: "conversation-prompt-v2",
    sessionId: "session-prompt-v2",
    musicProfileId: "music-prompt-v2",
    selectedMusicianIds: ["boya"],
  }, clock);
  state = scheduleMusicianTurn(state, {
    speakerIds: ["boya"],
    stageSubtitle: "先听伯牙。",
    userInvitation: "你看见了什么？",
  }, clock);
  state = recordMusicianMessage(state, {
    speakerId: "boya",
    content: "声音贴着地面延伸，边缘有细微颤动。",
  }, clock);
  state = recordUserMessage(state, "我看见一条深蓝色的河，水面必须有一道金光。", clock);
  const musicianMessage = state.messages.find((message) => message.role === "musician")!;
  const userMessage = state.messages.find((message) => message.role === "user")!;
  const scribe = await runVisualScribeAgent(
    { conversationState: state, musicContext: "能量缓慢上升。" },
    async () => ({
      model: "test-model",
      content: JSON.stringify({
        fields: {
          subject: { value: "一条深蓝色的河", status: "confirmed", sourceIds: [userMessage.id] },
          space: { value: "开阔的夜间河面", status: "confirmed", sourceIds: [userMessage.id] },
          composition: { value: "河流向画面深处收束", status: "suggested", sourceIds: [musicianMessage.id, userMessage.id] },
          motion: { value: ["贴地延伸", "轻微颤动"], status: "suggested", sourceIds: [musicianMessage.id] },
          materials: { value: ["平滑水面"], status: "suggested", sourceIds: [userMessage.id] },
          palette: { value: ["深蓝", "金色"], status: "confirmed", sourceIds: [userMessage.id] },
          lighting: { value: "水面一道金光", status: "confirmed", sourceIds: [userMessage.id] },
          atmosphere: { value: ["克制", "安静"], status: "suggested", sourceIds: [musicianMessage.id] },
          personalMeaning: { value: "黑暗中仍被托住的希望", status: "confirmed", sourceIds: [userMessage.id] },
          mustInclude: { value: ["深蓝色河流", "水面金光"], status: "confirmed", sourceIds: [userMessage.id] },
          mustAvoid: { value: ["人物"], status: "confirmed", sourceIds: [userMessage.id] },
        },
      }),
    })
  );
  const musicProfile = {
    schemaVersion: "2.0.0",
    id: "music-prompt-v2",
    audio: { name: "test", sourceKind: "upload", durationSeconds: 45 },
    rhythm: { bpm: { value: 72, confidence: 0.8, evidenceIds: [] }, beatStrength: { value: 0.5, confidence: 0.8, evidenceIds: [] }, onsetDensity: { value: "sparse", confidence: 0.8, evidenceIds: [] } },
    tonality: { key: { value: "D", confidence: 0.6, evidenceIds: [] }, mode: { value: "minor", confidence: 0.6, evidenceIds: [] }, harmonicStability: { value: 0.7, confidence: 0.7, evidenceIds: [] } },
    dynamics: { averageEnergy: { value: 0.4, confidence: 0.8, evidenceIds: [] }, dynamicComplexity: { value: 0.6, confidence: 0.8, evidenceIds: [] } },
    timbre: { brightness: { value: 0.3, confidence: 0.8, evidenceIds: [] }, warmth: { value: 0.6, confidence: 0.8, evidenceIds: [] }, roughness: { value: 0.2, confidence: 0.8, evidenceIds: [] }, noisiness: { value: 0.1, confidence: 0.8, evidenceIds: [] } },
    sections: [],
    semantics: { moods: [], genres: [], instruments: [], textures: [], motions: [], spaces: [] },
    warnings: [],
  } as unknown as MusicProfile;

  const input = buildPromptDirectorInput(
    characters,
    [{ characterId: "boya", text: musicianMessage.content }],
    { style: "自动", mood: "自动", tone: "自动" },
    userMessage.content,
    {},
    { musicProfile, visualBrief: scribe.brief, conversationState: state }
  );
  const subject = input.coCreation?.visualBrief.fields.find((field) => field.field === "subject");
  const subjectSource = scribe.brief.fields.subject.sources[0];

  assert.equal(input.coCreation?.musicProfile?.id, musicProfile.id);
  assert.equal(subject?.status, "confirmed");
  assert.deepEqual(subject?.sourceIds, [subjectSource.id]);
  assert.equal(
    input.coCreation?.sources.find((source) => source.id === subjectSource.id)?.excerpt,
    userMessage.content
  );
  assert.equal(
    input.coCreation?.sources.find((source) => source.id === userMessage.id)?.kind,
    "user-message"
  );

  const instruction = buildPromptDirectorInstruction(input);
  assert.match(instruction, /coCreation\.visualBrief is the authoritative visual plan/);
  assert.match(instruction, /mustInclude and mustAvoid always use constraint priority/);
  assert.match(instruction, /independent primary evidence/);
  assert.match(instruction, new RegExp(subjectSource.id));
  assert.match(instruction, /深蓝色的河/);
});
