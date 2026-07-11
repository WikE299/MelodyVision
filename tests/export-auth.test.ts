import assert from "node:assert/strict";
import test from "node:test";

import { authorizeExperimentExport } from "../lib/export-auth.ts";

test("experiment export is unavailable until a server token is configured", () => {
  const result = authorizeExperimentExport(new Headers(), "");
  assert.deepEqual(result, {
    ok: false,
    status: 503,
    error: "Experiment export is not configured",
  });
});

test("experiment export rejects a wrong token", () => {
  const result = authorizeExperimentExport(
    new Headers({ authorization: "Bearer wrong-token" }),
    "correct-token"
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 401);
});

test("experiment export accepts bearer and explicit export headers", () => {
  assert.deepEqual(
    authorizeExperimentExport(
      new Headers({ authorization: "Bearer correct-token" }),
      "correct-token"
    ),
    { ok: true }
  );
  assert.deepEqual(
    authorizeExperimentExport(
      new Headers({ "x-export-token": "correct-token" }),
      "correct-token"
    ),
    { ok: true }
  );
});
