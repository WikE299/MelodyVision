import assert from "node:assert/strict";
import test from "node:test";

import {
  CURRENT_STUDY_PROTOCOL_VERSION,
  type StudySession,
  type StudyTrial,
} from "../lib/contracts/study-trial.ts";
import {
  resolveStudyQuestionnaireProgress,
  type QuestionnaireResponse,
} from "../lib/questionnaires/index.ts";

const session: StudySession = {
  id: "study-1",
  participantId: "P001",
  deviceSessionId: "device-1",
  protocolVersion: CURRENT_STUDY_PROTOCOL_VERSION,
  sequence: "single_x_then_multi_y",
  status: "period_1",
  currentPeriod: 1,
  stimulusXId: "track-x",
  stimulusYId: "track-y",
  stimulusX: {
    id: "track-x", sourceKind: "preset", name: "Track X", artist: "Artist X",
    tags: [], source: "test", sourceUrl: "", playbackUrl: "/x.mp3",
    catalogItemId: "track-x", remoteSourceUrl: null, fileName: "x.mp3", fileSize: 0, mimeType: "audio/mpeg",
  },
  stimulusY: {
    id: "track-y", sourceKind: "preset", name: "Track Y", artist: "Artist Y",
    tags: [], source: "test", sourceUrl: "", playbackUrl: "/y.mp3",
    catalogItemId: "track-y", remoteSourceUrl: null, fileName: "y.mp3", fileSize: 0, mimeType: "audio/mpeg",
  },
  selectedMusicianIds: ["beethoven"],
  firstTrialId: "trial-1",
  secondTrialId: "trial-2",
  assignmentBlockId: "block-1",
  assignmentPosition: 1,
  createdAt: "2026-08-12T00:00:00.000Z",
  updatedAt: "2026-08-12T00:00:00.000Z",
  completedAt: null,
};

function trial(period: 1 | 2): StudyTrial {
  return {
    id: `trial-${period}`,
    participantId: "P001",
    sessionId: `device-${period}`,
    studySessionId: "study-1",
    period,
    stimulusId: period === 1 ? "track-x" : "track-y",
    condition: period === 1 ? "single_agent" : "multi_agent",
    assignmentMethod: "crossover_block",
    musicProfileId: `profile-${period}`,
    coCreatedRunId: `co-${period}`,
    baselineRunId: null,
    protocolVersion: CURRENT_STUDY_PROTOCOL_VERSION,
    comparisonOrder: null,
    status: "evaluating",
    createdAt: "2026-08-12T00:00:00.000Z",
    updatedAt: "2026-08-12T00:00:00.000Z",
  };
}

function completed(step: NonNullable<ReturnType<typeof resolveStudyQuestionnaireProgress>["nextStep"]>): QuestionnaireResponse {
  return {
    id: `response-${step.key}`,
    responseKey: step.key,
    participantId: "P001",
    studySessionId: "study-1",
    trialId: step.trialId,
    runId: step.runId,
    period: step.period,
    condition: step.condition,
    generationRole: step.generationRole,
    instrument: step.instrument,
    questionnaireVersion: "mv-questionnaires-1.1",
    scope: step.scope,
    status: "completed",
    answers: {},
    totalScore: null,
    metrics: {},
    startedAt: "2026-08-12T00:00:00.000Z",
    updatedAt: "2026-08-12T00:00:00.000Z",
    completedAt: "2026-08-12T00:00:00.000Z",
  };
}

test("streamlined questionnaire protocol follows 17 ordered steps without the legacy result checkpoint", () => {
  const responses: QuestionnaireResponse[] = [];
  const trials: StudyTrial[] = [];
  const evaluatedTrialIds: string[] = [];
  const comparedTrialIds: string[] = [];
  const observed: string[] = [];
  const resolve = () => resolveStudyQuestionnaireProgress({
    session,
    trials,
    responses,
    evaluatedTrialIds,
    comparedTrialIds,
  });

  let progress = resolve();
  assert.equal(progress.nextStep?.key, "session:background");
  responses.push(completed(progress.nextStep!));

  progress = resolve();
  assert.equal(progress.nextAction, "experience");
  trials.push(trial(1));
  progress = resolve();
  assert.equal(progress.nextStep?.key, "period:1:artwork:co_created");
  observed.push(progress.nextStep!.key);
  responses.push(completed(progress.nextStep!));
  progress = resolve();
  assert.equal(progress.nextAction, "wait_baseline");
  assert.deepEqual(progress.baselineEligibleTrialIds, ["trial-1"]);
  trials[0].baselineRunId = "baseline-1";

  while (true) {
    progress = resolve();
    if (progress.nextAction === "experience") break;
    assert.equal(progress.nextAction, "questionnaire");
    observed.push(progress.nextStep!.key);
    responses.push(completed(progress.nextStep!));
  }
  assert.deepEqual(observed, [
    "period:1:artwork:co_created",
    "period:1:artwork:direct_baseline",
    "period:1:csi",
    "period:1:agency_ownership",
    "period:1:sus",
    "period:1:raw_tlx",
    "period:1:manipulation_check",
  ]);

  trials.push(trial(2));
  progress = resolve();
  assert.equal(progress.nextStep?.key, "period:2:artwork:co_created");
  assert.deepEqual(progress.baselineEligibleTrialIds, ["trial-1"]);
  observed.push(progress.nextStep!.key);
  responses.push(completed(progress.nextStep!));
  progress = resolve();
  assert.equal(progress.nextAction, "wait_baseline");
  trials[1].baselineRunId = "baseline-2";
  while (true) {
    progress = resolve();
    if (progress.nextStep?.key === "session:preference") break;
    assert.equal(progress.nextAction, "questionnaire");
    observed.push(progress.nextStep!.key);
    responses.push(completed(progress.nextStep!));
  }
  assert.deepEqual(progress.baselineEligibleTrialIds, ["trial-1", "trial-2"]);

  for (const key of ["session:preference", "session:csi_weighting"]) {
    assert.equal(progress.nextStep?.key, key);
    observed.push(progress.nextStep!.key);
    responses.push(completed(progress.nextStep!));
    progress = resolve();
  }
  progress = resolve();
  assert.equal(progress.nextAction, "complete");
  assert.equal(responses.length, 17);
});

test("older integrated protocols retain the result-page checkpoint", () => {
  const legacySession = {
    ...session,
    protocolVersion: "v2-17-participant-selected-music",
  };
  const legacyTrial = {
    ...trial(1),
    protocolVersion: legacySession.protocolVersion,
  };
  const responses: QuestionnaireResponse[] = [];
  let progress = resolveStudyQuestionnaireProgress({
    session: legacySession,
    trials: [],
    responses,
  });
  responses.push(completed(progress.nextStep!));
  progress = resolveStudyQuestionnaireProgress({
    session: legacySession,
    trials: [legacyTrial],
    responses,
  });
  assert.equal(progress.nextAction, "result");
  assert.equal(progress.resultTrialId, legacyTrial.id);
});

test("new sessions select two tracks before the background questionnaire", () => {
  const responses: QuestionnaireResponse[] = [];
  const unselectedSession = { ...session, stimulusX: null, stimulusY: null };
  let progress = resolveStudyQuestionnaireProgress({ session: unselectedSession, trials: [], responses });
  assert.equal(progress.nextAction, "select_music");
  assert.equal(progress.nextStep, null);
  progress = resolveStudyQuestionnaireProgress({ session, trials: [], responses });
  assert.equal(progress.nextStep?.key, "session:background");
});
