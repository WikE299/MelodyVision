import {
  CSI_FACTOR_ITEMS,
  getQuestionnaireDefinition,
  NOT_APPLICABLE_VALUE,
} from "./definitions.ts";
import type {
  QuestionnaireAnswers,
  QuestionnaireDefinition,
  QuestionnaireInstrument,
  QuestionnaireScoreResult,
  QuestionnaireValidationResult,
} from "./types.ts";

function numericAnswer(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function rounded(value: number): number {
  return Math.round(value * 100) / 100;
}

export function validateQuestionnaireAnswers(
  definition: QuestionnaireDefinition,
  answers: QuestionnaireAnswers
): QuestionnaireValidationResult {
  const errors: Record<string, string> = {};
  for (const question of definition.questions) {
    const value = answers[question.id];
    const empty = value === undefined || value === null || value === "";
    if (empty) {
      if (question.required) errors[question.id] = "required";
      continue;
    }

    if (question.kind === "scale") {
      if (value === NOT_APPLICABLE_VALUE && question.allowNotApplicable) continue;
      const numeric = numericAnswer(value);
      if (
        numeric === null ||
        numeric < question.min ||
        numeric > question.max ||
        (numeric - question.min) % question.step !== 0
      ) {
        errors[question.id] = "invalid_scale_value";
      }
    } else if (question.kind === "number") {
      const numeric = numericAnswer(value);
      if (
        numeric === null ||
        numeric < question.min ||
        numeric > question.max ||
        (numeric - question.min) % question.step !== 0
      ) {
        errors[question.id] = "invalid_number";
      }
    } else if (question.kind === "choice") {
      if (typeof value !== "string" || !question.options.some((option) => option.value === value)) {
        errors[question.id] = "invalid_choice";
      }
    } else if (question.kind === "pair") {
      if (value !== question.left.value && value !== question.right.value) {
        errors[question.id] = "invalid_pair_choice";
      }
    } else if (question.kind === "text") {
      if (typeof value !== "string" || (question.maxLength && value.length > question.maxLength)) {
        errors[question.id] = "invalid_text";
      }
    }
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

function baseResult(
  instrument: QuestionnaireInstrument,
  complete: boolean,
  total: number | null,
  metrics: Record<string, number>
): QuestionnaireScoreResult {
  return {
    instrument,
    version: getQuestionnaireDefinition(instrument).version,
    complete,
    total: total === null ? null : rounded(total),
    metrics: Object.fromEntries(
      Object.entries(metrics).map(([key, value]) => [key, rounded(value)])
    ),
  };
}

export function scoreQuestionnaire(
  instrument: QuestionnaireInstrument,
  answers: QuestionnaireAnswers
): QuestionnaireScoreResult {
  const definition = getQuestionnaireDefinition(instrument);
  const validation = validateQuestionnaireAnswers(definition, answers);
  if (!validation.valid) return baseResult(instrument, false, null, {});

  if (instrument === "csi") {
    const factorScores: Record<string, number[]> = {};
    for (const [itemId, factor] of Object.entries(CSI_FACTOR_ITEMS)) {
      const answer = answers[itemId];
      const score = answer === NOT_APPLICABLE_VALUE ? 0 : numericAnswer(answer);
      if (score === null) return baseResult(instrument, false, null, {});
      (factorScores[factor] ||= []).push(score);
    }
    const metrics: Record<string, number> = {};
    for (const [factor, values] of Object.entries(factorScores)) {
      metrics[`${factor}_subtotal`] = values.reduce((sum, value) => sum + value, 0);
      metrics[`${factor}_mean`] = metrics[`${factor}_subtotal`] / values.length;
    }
    return baseResult(instrument, true, null, metrics);
  }

  if (instrument === "sus") {
    let contribution = 0;
    for (let index = 1; index <= 10; index += 1) {
      const value = numericAnswer(answers[`SUS${index}`]);
      if (value === null) return baseResult(instrument, false, null, {});
      contribution += index % 2 === 1 ? value - 1 : 5 - value;
    }
    return baseResult(instrument, true, contribution * 2.5, {});
  }

  if (instrument === "raw_tlx") {
    const metrics = Object.fromEntries(
      definition.questions.map((question) => [question.id.toLowerCase(), numericAnswer(answers[question.id]) || 0])
    );
    const values = Object.values(metrics);
    return baseResult(instrument, true, values.reduce((sum, value) => sum + value, 0) / values.length, metrics);
  }

  if (instrument === "csi_weighting") {
    const weights: Record<string, number> = {};
    for (const question of definition.questions) {
      const choice = answers[question.id];
      if (typeof choice !== "string") return baseResult(instrument, false, null, {});
      weights[choice] = (weights[choice] || 0) + 1;
    }
    return baseResult(instrument, true, null, weights);
  }

  if (instrument === "image_alignment") {
    const values = definition.questions.map((question) => numericAnswer(answers[question.id]) || 0);
    return baseResult(
      instrument,
      true,
      values.reduce((sum, value) => sum + value, 0) / values.length,
      Object.fromEntries(definition.questions.map((question, index) => [question.id.toLowerCase(), values[index]]))
    );
  }

  if (instrument === "manipulation_check") {
    const metrics = Object.fromEntries(
      definition.questions.map((question) => [question.id.toLowerCase(), numericAnswer(answers[question.id]) || 0])
    );
    return baseResult(instrument, true, null, metrics);
  }

  if (instrument === "agency_ownership") {
    const metrics = Object.fromEntries(
      definition.questions.map((question) => [question.id.toLowerCase(), numericAnswer(answers[question.id]) || 0])
    );
    return baseResult(instrument, true, null, metrics);
  }

  return baseResult(instrument, true, null, {});
}

export function scoreCsiWithWeights(
  csiAnswers: QuestionnaireAnswers,
  weightingAnswers: QuestionnaireAnswers
): QuestionnaireScoreResult {
  const csi = scoreQuestionnaire("csi", csiAnswers);
  const weighting = scoreQuestionnaire("csi_weighting", weightingAnswers);
  if (!csi.complete || !weighting.complete) {
    return baseResult("csi", false, null, {});
  }
  const factors = [
    "enjoyment",
    "exploration",
    "expressiveness",
    "immersion",
    "results_worth_effort",
  ];
  const weightedSum = factors.reduce((sum, factor) => (
    sum + (csi.metrics[`${factor}_subtotal`] || 0) * (weighting.metrics[factor] || 0)
  ), 0);
  const totalWeight = factors.reduce((sum, factor) => sum + (weighting.metrics[factor] || 0), 0);
  return baseResult("csi", true, totalWeight > 0 ? (weightedSum / totalWeight) * 5 : 0, {
    ...csi.metrics,
    ...Object.fromEntries(factors.map((factor) => [`${factor}_weight`, weighting.metrics[factor] || 0])),
  });
}
