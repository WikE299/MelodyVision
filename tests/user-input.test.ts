import assert from "node:assert/strict";
import test from "node:test";

import { isMeaningfulUserInput } from "../lib/conversation/user-input.ts";

test("starter text cannot be submitted without a personal continuation", () => {
  assert.equal(isMeaningfulUserInput("我最先看见的是……"), false);
  assert.equal(isMeaningfulUserInput("它像是在..."), false);
  assert.equal(isMeaningfulUserInput("  。  "), false);
});

test("a concrete user image is accepted", () => {
  assert.equal(isMeaningfulUserInput("我最先看见的是一朵白花，在水面慢慢打开。"), true);
  assert.equal(isMeaningfulUserInput("A dim path opens through the fog."), true);
});
