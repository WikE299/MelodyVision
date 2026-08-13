import assert from "node:assert/strict";
import test from "node:test";

import {
  createCompleteAnswers,
  getQuestionnaireDefinition,
  getQuestionnaireDefinitions,
  scoreCsiWithWeights,
  scoreQuestionnaire,
  validateQuestionnaireAnswers,
} from "../lib/questionnaires/index.ts";

test("formal questionnaire definitions keep the expected item counts", () => {
  const definitions = Object.fromEntries(
    getQuestionnaireDefinitions("zh").map((definition) => [definition.instrument, definition])
  );
  assert.equal(definitions.background.questions.length, 8);
  assert.equal(definitions.csi.questions.length, 10);
  assert.equal(definitions.agency_ownership.questions.length, 2);
  assert.equal(definitions.sus.questions.length, 10);
  assert.equal(definitions.raw_tlx.questions.length, 6);
  assert.equal(definitions.manipulation_check.questions.length, 2);
  assert.equal(definitions.csi_weighting.questions.length, 10);
  assert.equal(definitions.image_alignment.questions.length, 3);
  assert.equal(definitions.session_preference.questions.length, 2);
});

test("SUS scoring handles alternating item direction", () => {
  const answers = Object.fromEntries(Array.from({ length: 10 }, (_, index) => [`SUS${index + 1}`, 3]));
  const result = scoreQuestionnaire("sus", answers);
  assert.equal(result.complete, true);
  assert.equal(result.total, 50);
});

test("Raw NASA-TLX returns the unweighted mean and dimensions", () => {
  const result = scoreQuestionnaire("raw_tlx", {
    TLX_MD: 0,
    TLX_PD: 20,
    TLX_TD: 40,
    TLX_PE: 60,
    TLX_EF: 80,
    TLX_FR: 100,
  });
  assert.equal(result.complete, true);
  assert.equal(result.total, 50);
  assert.equal(result.metrics.tlx_fr, 100);
});

test("CSI excludes the collaboration factor", () => {
  const definition = getQuestionnaireDefinition("csi");
  const answers = createCompleteAnswers(definition);
  const validation = validateQuestionnaireAnswers(definition, answers);
  const result = scoreQuestionnaire("csi", answers);
  assert.equal(validation.valid, true);
  assert.equal(result.complete, true);
  assert.equal(definition.questions.some((question) => question.id.startsWith("CSI_COL")), false);
  assert.equal("collaboration_subtotal" in result.metrics, false);
});

test("CSI weighted total reaches 100 for maximum statements", () => {
  const csi = getQuestionnaireDefinition("csi");
  const weighting = getQuestionnaireDefinition("csi_weighting");
  const csiAnswers = Object.fromEntries(csi.questions.map((question) => [question.id, 10]));
  const weightingAnswers = createCompleteAnswers(weighting);
  const result = scoreCsiWithWeights(csiAnswers, weightingAnswers);
  assert.equal(result.complete, true);
  assert.equal(result.total, 100);
  assert.equal(
    Object.entries(result.metrics)
      .filter(([key]) => key.endsWith("_weight"))
      .reduce((sum, [, value]) => sum + value, 0),
    10
  );
});

test("image alignment uses the mean of three matched ratings", () => {
  const result = scoreQuestionnaire("image_alignment", {
    IMAGE_ALIGNMENT_1: 7,
    IMAGE_ALIGNMENT_2: 6,
    IMAGE_ALIGNMENT_3: 5,
  });
  assert.equal(result.complete, true);
  assert.equal(result.total, 6);
});

test("agency and ownership remain separate outcome metrics", () => {
  const result = scoreQuestionnaire("agency_ownership", {
    AGENCY: 4,
    OWNERSHIP: 5,
  });
  assert.equal(result.complete, true);
  assert.equal(result.total, null);
  assert.deepEqual(result.metrics, { agency: 4, ownership: 5 });
});

test("missing required answers do not produce a score", () => {
  const definition = getQuestionnaireDefinition("sus");
  const result = scoreQuestionnaire("sus", { SUS1: 5 });
  assert.equal(validateQuestionnaireAnswers(definition, { SUS1: 5 }).valid, false);
  assert.equal(result.complete, false);
  assert.equal(result.total, null);
});
