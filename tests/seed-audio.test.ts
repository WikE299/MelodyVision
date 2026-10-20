import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSeedAudioRequest,
  normalizeSeedAudioPrompt,
  parseImageDataUrl,
  SEED_AUDIO_MODEL,
} from "../lib/seed-audio.ts";
import {
  VISUAL_MUSIC_MODE_ORDER,
  VISUAL_MUSIC_MODES,
} from "../lib/visual-music-modes.ts";
import { isAudioLabEnabled } from "../lib/audio-lab/access.ts";
import { materializeSeedAudio, sliceAudioRange } from "../lib/storage/audio-lab.ts";

test("parseImageDataUrl accepts a supported image and strips the data URL prefix", () => {
  const parsed = parseImageDataUrl("data:image/png;base64,aGVsbG8=");
  assert.equal(parsed.mimeType, "image/png");
  assert.equal(parsed.base64, "aGVsbG8=");
  assert.equal(parsed.byteLength, 5);
});

test("parseImageDataUrl rejects unsupported files", () => {
  assert.throws(
    () => parseImageDataUrl("data:image/gif;base64,aGVsbG8="),
    /JPEG、PNG 或 WebP/
  );
});

test("buildSeedAudioRequest uses text-only generation and mp3 output", () => {
  const request = buildSeedAudioRequest(normalizeSeedAudioPrompt("纯器乐"));
  assert.equal(request.model, SEED_AUDIO_MODEL);
  assert.equal("references" in request, false);
  assert.equal(request.audio_config.format, "mp3");
  assert.equal(request.audio_config.sample_rate, 48000);
});

test("the three visible mode explanations are backed by distinct model rules", () => {
  assert.deepEqual(VISUAL_MUSIC_MODE_ORDER, ["instrumental", "interpretive", "soundscape"]);
  const definitions = VISUAL_MUSIC_MODE_ORDER.map((id) => VISUAL_MUSIC_MODES[id]);
  assert.equal(new Set(definitions.map((item) => item.modelRule)).size, 3);
  for (const item of definitions) {
    assert.ok(item.description);
    assert.ok(item.listeningCue);
    assert.ok(item.soundMaterials);
    assert.ok(item.organization);
    assert.match(item.modelRule, /No vocals|No voice/i);
  }
});

test("Audio Lab is local by default and requires an explicit production switch", () => {
  assert.equal(isAudioLabEnabled({ NODE_ENV: "development" }), true);
  assert.equal(isAudioLabEnabled({ NODE_ENV: "production" }), false);
  assert.equal(isAudioLabEnabled({ NODE_ENV: "production", AUDIO_LAB_ENABLED: "true" }), true);
  assert.equal(isAudioLabEnabled({ NODE_ENV: "development", AUDIO_LAB_ENABLED: "false" }), false);
});

test("Seed Audio output is materialized before the provider URL can expire", async () => {
  const fromBase64 = await materializeSeedAudio({ audioBase64: Buffer.from("audio-data").toString("base64") });
  assert.equal(fromBase64.bytes.toString(), "audio-data");

  const fromUrl = await materializeSeedAudio({
    audioUrl: "https://audio.example.test/result.mp3",
    fetcher: async () => new Response(Buffer.from("downloaded-audio"), {
      headers: { "content-type": "audio/mpeg" },
    }),
  });
  assert.equal(fromUrl.bytes.toString(), "downloaded-audio");
});

test("saved audio supports byte ranges for browser playback", () => {
  const result = sliceAudioRange(Buffer.from("0123456789"), "bytes=2-5");
  assert.equal(result.status, 206);
  assert.equal(result.body.toString(), "2345");
  assert.equal(result.contentRange, "bytes 2-5/10");
});
