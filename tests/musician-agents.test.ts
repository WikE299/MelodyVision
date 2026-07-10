import assert from "node:assert/strict";
import test from "node:test";

import { characters } from "../lib/characters/index.ts";
import {
  MUSICIAN_PROFILE_VERSION,
  buildMusicianAgentPrompt,
  musicianAgentProfiles,
  runMusicianAgent,
} from "../lib/agents/musicians/index.ts";

const OLD_CATCHPHRASES = [
  "弦外之音，方可入耳",
  "声无哀乐，尔自扰之",
  "胡笳一声兮断人肠",
  "二泉映月，月映二泉",
  "声音没有边界",
  "一切音乐，终为荣耀神与涤净心灵而作",
  "旋律若是天成，何必苦苦雕琢",
  "我要扼住命运的咽喉",
  "我们吹的不是曲子，是日子",
  "好歌，要让不识谱的人也能唱",
];

test("all ten selectable musicians have one complete agent profile", () => {
  assert.equal(musicianAgentProfiles.length, 10);
  assert.deepEqual(
    musicianAgentProfiles.map((profile) => profile.id).sort(),
    characters.map((character) => character.id).sort()
  );

  for (const profile of musicianAgentProfiles) {
    assert.ok(profile.listeningLenses.length >= 3, `${profile.id} needs multiple listening lenses`);
    assert.ok(profile.interpretiveTensions.length >= 3, `${profile.id} needs internal tensions`);
    assert.ok(profile.visualSensibilities.length >= 3, `${profile.id} needs visual sensitivities`);
    assert.ok(profile.avoidPatterns.length >= 4, `${profile.id} needs anti-caricature rules`);
  }
});

test("profiles do not contain the old fixed catchphrases", () => {
  const serialized = JSON.stringify(musicianAgentProfiles);
  for (const catchphrase of OLD_CATCHPHRASES) {
    assert.equal(serialized.includes(catchphrase), false, catchphrase);
  }
});

test("the common prompt requires evidence, interpretation, imagery, and a user invitation", () => {
  const prompt = buildMusicianAgentPrompt({
    profile: musicianAgentProfiles[0],
    musicContext: "动态逐渐抬升，声音线条保持流动。",
    userNote: "我想到一条夜路。",
  });

  assert.match(prompt, /可以从音乐证据中听到的现象/);
  assert.match(prompt, /个人解释/);
  assert.match(prompt, /可画面化/);
  assert.match(prompt, /开放问题邀请用户/);
  assert.match(prompt, /我想到一条夜路/);
  assert.doesNotMatch(prompt, /弦外之音，方可入耳/);
});

test("the runner loads one profile and removes analysis jargon from display text", async () => {
  let capturedPrompt = "";
  const result = await runMusicianAgent(
    {
      profile: musicianAgentProfiles[0],
      musicContext: "结构证据",
    },
    async (request) => {
      capturedPrompt = request.systemPrompt;
      return {
        content: "## 伯牙：\n- 30秒附近的线条在120 BPM下缓缓抬起，原先紧闭的空间也随之松开，像余音正在寻找一个可以停靠的位置。你觉得它正靠近哪里？",
        model: "test-model",
        usage: { inputTokens: 10, outputTokens: 20 },
      };
    }
  );

  assert.match(capturedPrompt, /伯牙/);
  assert.doesNotMatch(result.comment, /30秒/);
  assert.doesNotMatch(result.comment, /120 BPM/);
  assert.doesNotMatch(result.comment, /^伯牙：/);
  assert.equal(result.profileVersion, MUSICIAN_PROFILE_VERSION);
  assert.equal(result.model, "test-model");
  assert.equal(result.attempts, 1);
});

test("the runner retries an empty model response once", async () => {
  let calls = 0;
  const result = await runMusicianAgent(
    {
      profile: musicianAgentProfiles.find((profile) => profile.id === "beethoven")!,
      musicContext: "动机受阻后重新推进。",
    },
    async () => {
      calls += 1;
      return {
        content: calls === 1
          ? "……"
          : "短小的声音不断撞上阻力，又换了方向继续前进。它像一道被挤压后重新撑开的裂缝，边缘仍在震动。你听见的是对抗，还是重新组织自己的力量？",
        model: "test-model",
      };
    }
  );

  assert.equal(calls, 2);
  assert.equal(result.attempts, 2);
  assert.match(result.comment, /重新组织/);
});
