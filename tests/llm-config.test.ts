import assert from "node:assert/strict";
import test from "node:test";

import { callLLM } from "../lib/llm.ts";

test("LLM configuration is required only when a model call starts", async () => {
  const originalApiKey = process.env.LLM_API_KEY;
  delete process.env.LLM_API_KEY;

  try {
    await assert.rejects(
      callLLM({
        systemPrompt: "test",
        userMessage: "test",
      }),
      /LLM_API_KEY is not configured/
    );
  } finally {
    if (originalApiKey === undefined) {
      delete process.env.LLM_API_KEY;
    } else {
      process.env.LLM_API_KEY = originalApiKey;
    }
  }
});
