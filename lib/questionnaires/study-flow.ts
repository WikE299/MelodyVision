import type {
  StudySession,
  StudyTrial,
} from "../contracts/study-trial.ts";
import {
  CURRENT_STUDY_PROTOCOL_VERSION,
  usesStreamlinedQuestionnaires,
} from "../contracts/study-trial.ts";
import type { QuestionnaireInstrument } from "./types.ts";
import type {
  QuestionnaireResponse,
  StudyQuestionnaireProgress,
  StudyQuestionnaireStep,
} from "./study-types.ts";

const LEGACY_POST_PERIOD_INSTRUMENTS: QuestionnaireInstrument[] = [
  "csi",
  "sus",
  "raw_tlx",
  "manipulation_check",
];

const STREAMLINED_POST_PERIOD_INSTRUMENTS: QuestionnaireInstrument[] = [
  "csi",
  "agency_ownership",
  "sus",
  "raw_tlx",
  "manipulation_check",
];

const LEGACY_TOTAL_STEPS = 15;
const STREAMLINED_TOTAL_STEPS = 17;

export function questionnaireStepKey(input: {
  instrument: QuestionnaireInstrument;
  period?: 1 | 2 | null;
  generationRole?: "co_created" | "direct_baseline" | null;
}): string {
  if (input.instrument === "background") return "session:background";
  if (input.instrument === "session_preference") return "session:preference";
  if (input.instrument === "csi_weighting") return "session:csi_weighting";
  const period = input.period === 2 ? 2 : 1;
  if (input.instrument === "image_alignment") {
    return `period:${period}:artwork:${input.generationRole || "co_created"}`;
  }
  return `period:${period}:${input.instrument}`;
}

function step(
  input: Omit<StudyQuestionnaireStep, "key" | "sequenceTotal"> & {
    key?: string;
  },
  sequenceTotal: number
): StudyQuestionnaireStep {
  return {
    ...input,
    key: input.key || questionnaireStepKey(input),
    sequenceTotal,
  };
}

function responseComplete(
  responses: QuestionnaireResponse[],
  key: string
): boolean {
  return responses.some((response) => (
    response.responseKey === key && response.status === "completed"
  ));
}

function responseForStep(
  responses: QuestionnaireResponse[],
  candidate: StudyQuestionnaireStep
): QuestionnaireResponse | null {
  return responses.find((response) => response.responseKey === candidate.key) || null;
}

export function resolveStudyQuestionnaireProgress(input: {
  session: StudySession;
  trials: StudyTrial[];
  responses: QuestionnaireResponse[];
  evaluatedTrialIds?: string[];
  comparedTrialIds?: string[];
}): StudyQuestionnaireProgress {
  const trials = [...input.trials].sort((left, right) => (left.period || 0) - (right.period || 0));
  const evaluatedTrialIds = new Set(input.evaluatedTrialIds || []);
  const comparedTrialIds = new Set(input.comparedTrialIds || []);
  const streamlined = usesStreamlinedQuestionnaires(input.session.protocolVersion);
  const sequenceTotal = streamlined ? STREAMLINED_TOTAL_STEPS : LEGACY_TOTAL_STEPS;
  const postPeriodInstruments = streamlined
    ? STREAMLINED_POST_PERIOD_INSTRUMENTS
    : LEGACY_POST_PERIOD_INSTRUMENTS;
  const completedKeys = input.responses
    .filter((response) => response.status === "completed")
    .map((response) => response.responseKey);
  const baselineEligibleTrialIds = trials
    .filter((trial) => Boolean(trial.coCreatedRunId) && (
      streamlined
        ? responseComplete(input.responses, questionnaireStepKey({
            instrument: "image_alignment",
            period: trial.period,
            generationRole: "co_created",
          }))
        : evaluatedTrialIds.has(trial.id)
    ))
    .map((trial) => trial.id);
  if (
    input.session.protocolVersion === CURRENT_STUDY_PROTOCOL_VERSION &&
    (!input.session.stimulusX || !input.session.stimulusY)
  ) {
    return {
      nextAction: "select_music",
      nextStep: null,
      resultTrialId: null,
      responses: input.responses,
      completedKeys,
      baselineEligibleTrialIds,
    };
  }

  const background = step({
    instrument: "background",
    scope: "pre_study",
    trialId: null,
    runId: null,
    period: null,
    condition: null,
    generationRole: null,
    sequenceIndex: 1,
  }, sequenceTotal);
  if (!responseComplete(input.responses, background.key)) {
    return {
      nextAction: "questionnaire",
      nextStep: background,
      resultTrialId: null,
      responses: input.responses,
      completedKeys,
      baselineEligibleTrialIds,
    };
  }

  let sequenceIndex = 2;
  for (const period of [1, 2] as const) {
    const trial = trials.find((candidate) => candidate.period === period);
    if (!trial?.coCreatedRunId) {
      return {
        nextAction: "experience",
        nextStep: null,
        resultTrialId: null,
        responses: input.responses,
        completedKeys,
        baselineEligibleTrialIds,
      };
    }
    if (!streamlined && (!evaluatedTrialIds.has(trial.id) || !comparedTrialIds.has(trial.id))) {
      return {
        nextAction: "result",
        nextStep: null,
        resultTrialId: trial.id,
        responses: input.responses,
        completedKeys,
        baselineEligibleTrialIds,
      };
    }
    const artworkStep = step({
      instrument: "image_alignment",
      scope: "artwork",
      trialId: trial.id,
      runId: trial.coCreatedRunId,
      period,
      condition: trial.condition,
      generationRole: "co_created",
      sequenceIndex,
      imageLabel: `体验 ${period} 的共创作品`,
    }, sequenceTotal);
    sequenceIndex += 1;
    if (!responseComplete(input.responses, artworkStep.key)) {
      return {
        nextAction: "questionnaire",
        nextStep: artworkStep,
        resultTrialId: null,
        responses: input.responses,
        completedKeys,
        baselineEligibleTrialIds,
      };
    }

    if (!trial.baselineRunId) {
      return {
        nextAction: "wait_baseline",
        nextStep: null,
        resultTrialId: null,
        responses: input.responses,
        completedKeys,
        baselineEligibleTrialIds,
      };
    }
    const baselineStep = step({
      instrument: "image_alignment",
      scope: "artwork",
      trialId: trial.id,
      runId: trial.baselineRunId,
      period,
      condition: trial.condition,
      generationRole: "direct_baseline",
      sequenceIndex,
      imageLabel: `体验 ${period} 的音乐直出作品`,
    }, sequenceTotal);
    sequenceIndex += 1;
    if (!responseComplete(input.responses, baselineStep.key)) {
      return {
        nextAction: "questionnaire",
        nextStep: baselineStep,
        resultTrialId: null,
        responses: input.responses,
        completedKeys,
        baselineEligibleTrialIds,
      };
    }

    for (const instrument of postPeriodInstruments) {
      const periodStep = step({
        instrument,
        scope: "post_period",
        trialId: trial.id,
        runId: trial.coCreatedRunId,
        period,
        condition: trial.condition,
        generationRole: null,
        sequenceIndex,
      }, sequenceTotal);
      sequenceIndex += 1;
      if (!responseComplete(input.responses, periodStep.key)) {
        return {
          nextAction: "questionnaire",
          nextStep: periodStep,
          resultTrialId: null,
          responses: input.responses,
          completedKeys,
          baselineEligibleTrialIds,
        };
      }
    }
  }

  const preferenceStep = step({
    instrument: "session_preference",
    scope: "post_session",
    trialId: null,
    runId: null,
    period: null,
    condition: null,
    generationRole: null,
    sequenceIndex,
  }, sequenceTotal);
  sequenceIndex += 1;
  if (!responseComplete(input.responses, preferenceStep.key)) {
    return {
      nextAction: "questionnaire",
      nextStep: preferenceStep,
      resultTrialId: null,
      responses: input.responses,
      completedKeys,
      baselineEligibleTrialIds,
    };
  }

  const weightingStep = step({
    instrument: "csi_weighting",
    scope: "post_session",
    trialId: null,
    runId: null,
    period: null,
    condition: null,
    generationRole: null,
    sequenceIndex,
  }, sequenceTotal);
  if (!responseComplete(input.responses, weightingStep.key)) {
    return {
      nextAction: "questionnaire",
      nextStep: weightingStep,
      resultTrialId: null,
      responses: input.responses,
      completedKeys,
      baselineEligibleTrialIds,
    };
  }

  return {
    nextAction: "complete",
    nextStep: null,
    resultTrialId: null,
    responses: input.responses,
    completedKeys,
    baselineEligibleTrialIds: [],
  };
}

export function answersForNextStep(
  progress: StudyQuestionnaireProgress
) {
  if (!progress.nextStep) return {};
  return responseForStep(progress.responses, progress.nextStep)?.answers || {};
}
