import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import {
  ARTICULATION_STEPS,
  FORMATIVE_DISCUSSION_QUESTIONS,
  IMAGINATION_EXAMPLES,
  MUSICIAN_PERSPECTIVES,
  RESONANCE_CASES,
} from "../lib/formative-study.ts";

test("resonance cases have unique IDs and attributable HTTPS sources", () => {
  assert.equal(new Set(RESONANCE_CASES.map((item) => item.id)).size, RESONANCE_CASES.length);
  for (const item of RESONANCE_CASES) {
    assert.match(item.sourceUrl, /^https:\/\//);
    assert.ok(item.sourceLabel.trim());
    assert.ok(item.rights.trim());
    assert.ok(item.relevance.trim());
    assert.match(item.image.creditUrl, /^https:\/\//);
    assert.ok(item.image.alt.trim());
    assert.ok(item.image.width > 0);
    assert.ok(item.image.height > 0);
    assert.ok(existsSync(`public${item.image.src}`), `missing case image: ${item.image.src}`);
  }
});

test("musician perspectives stay complementary and question-led", () => {
  assert.equal(MUSICIAN_PERSPECTIVES.length, 4);
  assert.equal(new Set(MUSICIAN_PERSPECTIVES.map((item) => item.id)).size, 4);
  for (const item of MUSICIAN_PERSPECTIVES) {
    assert.match(item.question, /？$/);
    assert.ok(item.contribution.startsWith("帮助") || item.contribution.startsWith("补充"));
  }
});

test("showcase keeps a concise formative discussion and visual examples", () => {
  assert.equal(FORMATIVE_DISCUSSION_QUESTIONS.length, 6);
  assert.ok(FORMATIVE_DISCUSSION_QUESTIONS.some((question) => question.includes("哪些元素不可缺少")));
  assert.equal(ARTICULATION_STEPS.length, 3);
  assert.equal(new Set(ARTICULATION_STEPS.map((step) => step.id)).size, 3);
  assert.equal(IMAGINATION_EXAMPLES.length, 3);
  for (const example of IMAGINATION_EXAMPLES) {
    assert.match(example.src, /^\/formative-study\/.+\.webp$/);
    assert.ok(example.alt.trim());
    assert.ok(example.caption.trim());
  }
});
