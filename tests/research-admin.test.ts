import assert from "node:assert/strict";
import test from "node:test";

import { buildResearchDeletionPlan } from "../lib/research-admin.ts";
import type { RawExperimentExport } from "../lib/research-dashboard.ts";

function fixture(): RawExperimentExport {
  return {
    schemaVersion: 7,
    exportedAt: "2026-09-10T12:00:00.000Z",
    sessions: [{ id: "runtime-1", created_at: "2026-09-10T10:00:00.000Z" }],
    studySessions: [{ id: "study-1", created_at: "2026-09-10T10:00:00.000Z" }],
    studyAssignmentBlocks: [],
    sessionComparisons: [{ id: "session-comparison-1", study_session_id: "study-1" }],
    audioAnalyses: [
      { id: "audio-1", trial_id: "trial-1", session_id: "runtime-1", created_at: "2026-09-10T10:01:00.000Z" },
      { id: "audio-2", trial_id: "trial-2", session_id: "runtime-1", created_at: "2026-09-10T11:01:00.000Z" },
    ],
    conversationSnapshots: [{ id: "conversation-1", trial_id: "trial-1", session_id: "runtime-1", created_at: "2026-09-10T10:02:00.000Z" }],
    visualBriefVersions: [{ id: "brief-1", trial_id: "trial-1", session_id: "runtime-1", created_at: "2026-09-10T10:03:00.000Z" }],
    interactionEvents: [{ id: "event-1", trial_id: "trial-1", session_id: "runtime-1", created_at: "2026-09-10T10:04:00.000Z" }],
    runs: [
      { id: "run-1", trial_id: "trial-1", image_url: "/generated/run-1.png" },
      { id: "run-2", trial_id: "trial-2", image_url: "https://example.supabase.co/storage/v1/object/public/generated/artworks/run-2.webp" },
    ],
    feedback: [{ id: "feedback-1", run_id: "run-1" }],
    trials: [
      {
        id: "trial-1",
        study_session_id: "study-1",
        session_id: "runtime-1",
        co_created_run_id: "run-1",
        baseline_run_id: "",
        created_at: "2026-09-10T10:00:00.000Z",
      },
      {
        id: "trial-2",
        study_session_id: "study-1",
        session_id: "runtime-1",
        co_created_run_id: "run-2",
        baseline_run_id: "",
        created_at: "2026-09-10T11:00:00.000Z",
      },
    ],
    baselineJobs: [{ trial_id: "trial-1" }],
    artworkEvaluations: [{ id: "evaluation-1", trial_id: "trial-1" }],
    pairwiseComparisons: [],
    labeledComparisons: [{ id: "comparison-1", trial_id: "trial-1" }],
    manipulationChecks: [{ id: "check-1", trial_id: "trial-1" }],
    questionnaireResponses: [
      { id: "questionnaire-1", trial_id: "trial-1", study_session_id: "study-1" },
      { id: "questionnaire-session", trial_id: "", study_session_id: "study-1" },
    ],
    annotations: [],
    adminActions: [],
  };
}

test("session purge preview includes paired trials, generated images, and dependent records", () => {
  const plan = buildResearchDeletionPlan(fixture(), [
    { entityType: "study_session", entityId: "study-1" },
  ]);

  assert.deepEqual(plan.idsByTable.study_trials.sort(), ["trial-1", "trial-2"]);
  assert.deepEqual(plan.idsByTable.generation_runs.sort(), ["run-1", "run-2"]);
  assert.deepEqual(plan.idsByTable.questionnaire_responses.sort(), ["questionnaire-1", "questionnaire-session"]);
  assert.deepEqual(plan.idsByTable.audio_analyses.sort(), ["audio-1", "audio-2"]);
  assert.deepEqual(plan.idsByTable.experiment_sessions, ["runtime-1"]);
  assert.equal(plan.images.length, 2);
  assert.equal(plan.counts.interaction_events, 1);
  assert.equal(plan.protectedTargets.length, 0);
});

test("single trial purge does not remove a runtime session that still has another trial", () => {
  const plan = buildResearchDeletionPlan(fixture(), [
    { entityType: "trial", entityId: "trial-1" },
  ]);

  assert.deepEqual(plan.idsByTable.study_trials, ["trial-1"]);
  assert.deepEqual(plan.idsByTable.experiment_sessions, []);
  assert.deepEqual(plan.idsByTable.audio_analyses, ["audio-1"]);
  assert.match(plan.warnings[0], /实验会话变为不完整/);
});

test("protected session annotations block destructive actions in the plan", () => {
  const data = fixture();
  data.annotations = [{
    entity_type: "study_session",
    entity_id: "study-1",
    classification: "formal",
    protected: 1,
  }];

  const plan = buildResearchDeletionPlan(data, [
    { entityType: "study_session", entityId: "study-1" },
  ]);
  assert.deepEqual(plan.protectedTargets, [
    { entityType: "study_session", entityId: "study-1" },
  ]);
});
