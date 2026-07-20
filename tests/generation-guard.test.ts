import assert from "node:assert/strict";
import test from "node:test";
import { isGenerationActionBlocked } from "../lib/conversation/generation-guard.ts";

const idleActivity = {
  generating: false,
  submittingUserNote: false,
  hasPendingUserMessage: false,
  loadingCount: 0,
  streamingCount: 0,
};

test("generation remains available when the conversation is idle", () => {
  assert.equal(isGenerationActionBlocked(idleActivity), false);
});

test("generation is blocked while the latest conversation state is still changing", () => {
  for (const activity of [
    { ...idleActivity, submittingUserNote: true },
    { ...idleActivity, hasPendingUserMessage: true },
    { ...idleActivity, loadingCount: 1 },
    { ...idleActivity, streamingCount: 1 },
    { ...idleActivity, generating: true },
  ]) {
    assert.equal(isGenerationActionBlocked(activity), true);
  }
});
