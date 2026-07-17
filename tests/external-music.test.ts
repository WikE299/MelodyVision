import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedJamendoAudioUrl } from "../lib/audio/external-music.ts";

test("Jamendo audio proxy accepts only official HTTPS storage URLs", () => {
  assert.equal(
    isAllowedJamendoAudioUrl("https://prod-1.storage.jamendo.com/?trackid=1210558&format=mp31"),
    true
  );
  assert.equal(isAllowedJamendoAudioUrl("http://prod-1.storage.jamendo.com/track.mp3"), false);
  assert.equal(isAllowedJamendoAudioUrl("https://prod-1.storage.jamendo.com.evil.example/track.mp3"), false);
  assert.equal(isAllowedJamendoAudioUrl("https://user@prod-1.storage.jamendo.com/track.mp3"), false);
  assert.equal(isAllowedJamendoAudioUrl("https://example.com/track.mp3"), false);
});
