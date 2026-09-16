import assert from "node:assert/strict";
import test from "node:test";

import { isAcceptanceFlowRequest } from "../lib/acceptance-flow-access.ts";

test("acceptance flow is restricted to local hosts", () => {
  assert.equal(isAcceptanceFlowRequest(new Headers({ host: "localhost:3000" })), true);
  assert.equal(isAcceptanceFlowRequest(new Headers({ host: "127.0.0.1:3000" })), true);
  assert.equal(isAcceptanceFlowRequest(new Headers({ host: "[::1]:3000" })), true);
  assert.equal(isAcceptanceFlowRequest(new Headers({ host: "melodyvision.example" })), false);
});
