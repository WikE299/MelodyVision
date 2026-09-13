import assert from "node:assert/strict";
import test from "node:test";

import { shouldSubmitOnEnter } from "../lib/ui/keyboard-submit.ts";

test("Enter submits a listening-room message", () => {
  assert.equal(shouldSubmitOnEnter({ key: "Enter" }), true);
});

test("Shift+Enter keeps a newline and other keys do not submit", () => {
  assert.equal(shouldSubmitOnEnter({ key: "Enter", shiftKey: true }), false);
  assert.equal(shouldSubmitOnEnter({ key: "a" }), false);
});

test("IME confirmation Enter does not submit prematurely", () => {
  assert.equal(
    shouldSubmitOnEnter({ key: "Enter", nativeEvent: { isComposing: true } }),
    false
  );
});
