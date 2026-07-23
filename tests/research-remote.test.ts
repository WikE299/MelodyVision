import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchRemoteResearchExport,
  fetchSupabaseResearchExport,
  getRemoteResearchConfig,
  getRemoteSupabaseResearchConfig,
} from "../lib/research-remote.ts";

test("remote research sync stays disabled without URL and token", () => {
  assert.equal(getRemoteResearchConfig({}), null);
  assert.equal(getRemoteResearchConfig({ RESEARCH_REMOTE_EXPORT_URL: "https://example.com/export" }), null);
});

test("remote research sync accepts HTTPS and keeps the token server-side", async () => {
  const config = getRemoteResearchConfig({
    RESEARCH_REMOTE_EXPORT_URL: "https://example.com/api/experiment/export",
    RESEARCH_REMOTE_EXPORT_TOKEN: "secret-token",
  });
  assert.ok(config);

  const snapshot = await fetchRemoteResearchExport(config, async (_input, init) => {
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("authorization"), "Bearer secret-token");
    return new Response(JSON.stringify({ schemaVersion: 4, trials: [] }), {
      headers: { "content-type": "application/json" },
    });
  });
  assert.deepEqual(snapshot, { schemaVersion: 4, trials: [] });
});

test("remote research sync rejects insecure non-local endpoints", () => {
  assert.throws(() => getRemoteResearchConfig({
    RESEARCH_REMOTE_EXPORT_URL: "http://example.com/api/experiment/export",
    RESEARCH_REMOTE_EXPORT_TOKEN: "secret-token",
  }), /must use HTTPS/);
});

test("direct Supabase research sync reads tables with a server-only key", async () => {
  const config = getRemoteSupabaseResearchConfig({
    RESEARCH_SUPABASE_URL: "https://project.supabase.co",
    RESEARCH_SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  });
  assert.ok(config);

  let requestCount = 0;
  const snapshot = await fetchSupabaseResearchExport(config, async (input, init) => {
    requestCount += 1;
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("apikey"), "service-role-key");
    assert.equal(headers.get("authorization"), "Bearer service-role-key");
    const rows = String(input).includes("generation_runs")
      ? [{ id: "run-1", timings_json: "{\"totalMs\":1234}" }]
      : [];
    return Response.json(rows);
  }) as Record<string, unknown>;

  assert.equal(requestCount, 13);
  assert.equal(snapshot.schemaVersion, 4);
  assert.deepEqual(snapshot.trials, []);
  assert.deepEqual(snapshot.runs, [{ id: "run-1", timings: { totalMs: 1234 } }]);
});
