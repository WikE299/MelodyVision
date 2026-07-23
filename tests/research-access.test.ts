import assert from "node:assert/strict";
import test from "node:test";

import { isLocalResearchRequest } from "../lib/research-access.ts";

test("research dashboard requires the explicit feature flag", () => {
  assert.equal(isLocalResearchRequest(new Headers({ host: "localhost:3000" }), false), false);
});

test("research dashboard accepts loopback hosts when enabled", () => {
  assert.equal(isLocalResearchRequest(new Headers({ host: "localhost:3000" }), true), true);
  assert.equal(isLocalResearchRequest(new Headers({ host: "127.0.0.1:3000" }), true), true);
  assert.equal(isLocalResearchRequest(new Headers({ host: "[::1]:3000" }), true), true);
});

test("research dashboard rejects non-local hosts when enabled", () => {
  assert.equal(isLocalResearchRequest(new Headers({ host: "melodyvision.example" }), true), false);
  assert.equal(isLocalResearchRequest(new Headers({ host: "localhost.example:3000" }), true), false);
});
