import assert from "node:assert/strict";
import test from "node:test";

import { isQuestionnaireLabRequest } from "../lib/questionnaire-lab-access.ts";

test("questionnaire lab requires both the feature flag and a local host", () => {
  assert.equal(isQuestionnaireLabRequest(new Headers({ host: "localhost:3000" }), true), true);
  assert.equal(isQuestionnaireLabRequest(new Headers({ host: "127.0.0.1:3000" }), true), true);
  assert.equal(isQuestionnaireLabRequest(new Headers({ host: "melodyvision.example" }), true), false);
  assert.equal(isQuestionnaireLabRequest(new Headers({ host: "localhost:3000" }), false), false);
});
