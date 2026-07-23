import assert from "node:assert/strict";
import test from "node:test";

import {
  buildResearchDashboardDataset,
  exportResearchTrialsCsv,
  summarizeResearchTrials,
} from "../lib/research-dashboard.ts";

function fixture() {
  return {
    schemaVersion: 4,
    exportedAt: "2026-07-18T00:00:00.000Z",
    sessions: [],
    audioAnalyses: [
      {
        id: "audio-current",
        trial_id: "trial-current",
        session_id: "session-current",
        created_at: "2026-07-18T00:00:01.000Z",
        mode: "rich",
        source_kind: "preset",
        file_name: "current.mp3",
        music_profile: {
          id: "music-current",
          audio: { name: "Current Song", sourceKind: "preset" },
        },
      },
      {
        id: "audio-legacy",
        trial_id: "trial-legacy",
        session_id: "session-legacy",
        created_at: "2026-07-17T00:00:01.000Z",
        mode: "rich",
        source_kind: "upload",
        file_name: "legacy.mp3",
        music_profile: {
          id: "music-legacy",
          audio: { name: "Legacy Song", sourceKind: "upload" },
        },
      },
    ],
    conversationSnapshots: [],
    visualBriefVersions: [],
    interactionEvents: [] as Array<Record<string, unknown>>,
    runs: [
      {
        id: "co-current",
        trial_id: "trial-current",
        session_id: "session-current",
        generation_role: "co_created",
        created_at: "2026-07-18T00:01:00.000Z",
        image_url: "/generated/co.png",
        timings: { totalMs: 1000 },
      },
      {
        id: "base-current",
        trial_id: "trial-current",
        session_id: "session-current",
        generation_role: "direct_baseline",
        created_at: "2026-07-18T00:01:01.000Z",
        image_url: "/generated/base.png",
        timings: { totalMs: 2000 },
      },
    ],
    feedback: [],
    trials: [
      {
        id: "trial-current",
        participant_id: "=unsafe",
        session_id: "session-current",
        condition: "multi_agent",
        assignment_method: "demo_choice",
        music_profile_id: "music-current",
        co_created_run_id: "co-current",
        baseline_run_id: "base-current",
        protocol_version: "v2-14-labeled-comparison",
        status: "completed",
        created_at: "2026-07-18T00:00:00.000Z",
        updated_at: "2026-07-18T00:02:00.000Z",
      },
      {
        id: "trial-legacy",
        participant_id: "legacy-user",
        session_id: "session-legacy",
        condition: "single_agent",
        assignment_method: "demo_choice",
        music_profile_id: "music-legacy",
        co_created_run_id: "",
        baseline_run_id: "",
        protocol_version: "v2-13-blind-comparison",
        status: "completed",
        created_at: "2026-07-17T00:00:00.000Z",
        updated_at: "2026-07-17T00:02:00.000Z",
      },
    ],
    baselineJobs: [
      {
        trial_id: "trial-current",
        status: "completed",
        run_id: "base-current",
        error: "",
      },
      {
        trial_id: "trial-legacy",
        status: "failed",
        run_id: null,
        error: "quota",
      },
    ],
    artworkEvaluations: [
      {
        trial_id: "trial-current",
        music_match_score: 5,
        imagination_match_score: 4,
        agency_score: 3,
        ownership_score: 4,
        immersion_score: 5,
        satisfaction_score: 4,
      },
      {
        trial_id: "trial-legacy",
        music_match_score: 2,
        imagination_match_score: 3,
        agency_score: 2,
        ownership_score: 3,
        immersion_score: null,
        satisfaction_score: null,
      },
    ],
    pairwiseComparisons: [
      {
        trial_id: "trial-legacy",
        music_match_choice: "direct_baseline",
        aesthetic_choice: "tie",
        overall_choice: "direct_baseline",
        reason: "",
      },
    ],
    labeledComparisons: [
      {
        trial_id: "trial-current",
        music_match_choice: "co_created",
        imagination_match_choice: "co_created",
        overall_choice: "tie",
        reason: "The image matched.",
      },
    ],
    manipulationChecks: [
      {
        trial_id: "trial-current",
        perspective_multiplicity_score: 4,
        articulation_support_score: 5,
        dialogue_experience_score: 4,
      },
    ],
  };
}

test("dashboard defaults its summary to the current protocol", () => {
  const dataset = buildResearchDashboardDataset(fixture(), "snapshot");
  assert.equal(dataset.trials.length, 2);
  assert.equal(dataset.summary.totalTrials, 1);
  assert.equal(dataset.summary.questionnaireCompleteTrials, 1);
  assert.equal(dataset.summary.artworkScores[0].mean, 5);
  assert.deepEqual(dataset.protocols, [
    "v2-13-blind-comparison",
    "v2-14-labeled-comparison",
  ]);
});

test("legacy missing scores are not treated as zero", () => {
  const dataset = buildResearchDashboardDataset(fixture());
  const allSummary = summarizeResearchTrials(dataset.trials);
  const immersion = allSummary.artworkScores.find((metric) => metric.key === "immersion_score");
  assert.equal(immersion?.count, 1);
  assert.equal(immersion?.mean, 5);
});

test("dashboard reports failed baseline and legacy protocol issues", () => {
  const dataset = buildResearchDashboardDataset(fixture());
  const legacy = dataset.trials.find((trial) => trial.id === "trial-legacy");
  assert.ok(legacy);
  assert.equal(legacy.questionnaireComplete, true);
  assert.equal(legacy.baselineComplete, false);
  assert.ok(legacy.issues.some((item) => item.code === "baseline_failed"));
  assert.ok(legacy.issues.some((item) => item.code === "legacy_protocol"));
  assert.ok(legacy.issues.some((item) => item.code === "missing_co_created_run"));
});

test("dashboard CSV is one row per trial and neutralizes formulas", () => {
  const dataset = buildResearchDashboardDataset(fixture());
  const csv = exportResearchTrialsCsv(dataset.trials);
  assert.equal(csv.trim().split("\n").length, 3);
  assert.match(csv, /"'=unsafe"/);
  assert.match(csv, /music_match_score/);
  assert.match(csv, /baseline_failed/);
});

test("snapshot validation rejects incomplete exports", () => {
  assert.throws(
    () => buildResearchDashboardDataset({ schemaVersion: 3, trials: [] }),
    /schemaVersion 4/
  );
  assert.throws(
    () => buildResearchDashboardDataset({ schemaVersion: 4 }),
    /trials/
  );
});

test("unlinked session records are bounded by adjacent trials", () => {
  const data = fixture();
  data.interactionEvents = [
    {
      id: "before-current",
      session_id: "session-current",
      trial_id: "",
      created_at: "2026-07-17T23:59:59.000Z",
      event_type: "old",
    },
    {
      id: "during-current",
      session_id: "session-current",
      trial_id: "",
      created_at: "2026-07-18T00:00:10.000Z",
      event_type: "current",
    },
  ];
  const dataset = buildResearchDashboardDataset(data);
  const current = dataset.trials.find((trial) => trial.id === "trial-current");
  assert.deepEqual(current?.interactionEvents.map((event) => event.id), ["during-current"]);
});
