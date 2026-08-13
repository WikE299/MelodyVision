import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { CURRENT_STUDY_PROTOCOL_VERSION } from "../lib/contracts/study-trial.ts";

test("study trial persistence keeps one idempotent baseline and paired run metadata", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "melodyvision-study-"));
  process.env.MELODYVISION_DATA_DIR = directory;
  try {
    const trials = await import("../lib/db/study-trials.ts");
    const runs = await import("../lib/db/generation-runs.ts");
    const evaluations = await import("../lib/db/trial-evaluations.ts");
    const exports = await import("../lib/db/export.ts");
    const trial = await trials.createStudyTrial({
      participantId: "participant-1",
      sessionId: "session-1",
      condition: "multi_agent",
      assignmentMethod: "demo_choice",
      musicProfileId: "music-1",
    });

    const recovered = await trials.recoverStudyTrial({
      id: "recovered-trial",
      participantId: "participant-recovered",
      sessionId: "session-recovered",
      condition: "single_agent",
      assignmentMethod: "demo_choice",
      musicProfileId: "music-recovered",
    });
    const duplicateRecovery = await trials.recoverStudyTrial({
      id: "recovered-trial",
      participantId: "participant-recovered",
      sessionId: "session-recovered",
      condition: "single_agent",
      assignmentMethod: "demo_choice",
      musicProfileId: "music-recovered",
    });
    assert.equal(recovered.recovered, true);
    assert.equal(recovered.trial.id, "recovered-trial");
    assert.equal(duplicateRecovery.recovered, false);

    const balanced = await Promise.all(Array.from({ length: 12 }, (_, index) =>
      trials.createBalancedStudyTrial({
        participantId: `balanced-participant-${index}`,
        sessionId: `balanced-session-${index}`,
        musicProfileId: `balanced-music-${index}`,
      })
    ));
    const multiCount = balanced.filter((item) => item.condition === "multi_agent").length;
    const singleCount = balanced.filter((item) => item.condition === "single_agent").length;
    assert.ok(Math.abs(multiCount - singleCount) <= 1);
    assert.ok(balanced.every((item) => item.assignmentMethod === "balanced_random"));

    const baselineRecord = {
      id: "run-baseline",
      sessionId: trial.sessionId,
      trialId: trial.id,
      generationRole: "direct_baseline" as const,
      condition: trial.condition,
      createdAt: "2026-07-13T00:00:00.000Z",
      selectedCharacters: [],
      presets: {},
      userNote: "",
      musicAnalysis: { musicProfileId: trial.musicProfileId },
      musicProfile: { id: trial.musicProfileId },
      conversationState: null,
      visualBrief: null,
      musicianComments: [],
      promptDirector: {},
      finalImagePrompt: "A music-only visual reference.",
      negativePrompt: "text, logo, watermark",
      imageUrl: "/generated/baseline.png",
      remoteImageUrl: "https://example.invalid/baseline.png",
      imageProvider: "test",
      imageModel: "test-model",
      imageSize: "1696*960",
      imageRequestId: "request-1",
      timings: { totalMs: 1 },
      modelConfig: { imageModel: "test-model" },
      logPath: "logs/test.json",
    };
    await runs.insertGenerationRun({
      ...baselineRecord,
      id: "run-co-created",
      generationRole: "co_created",
      selectedCharacters: ["beethoven"],
      conversationState: { trialId: trial.id, condition: trial.condition },
      visualBrief: { subject: "a bridge" },
      musicianComments: [{ characterId: "beethoven", text: "forward motion" }],
      finalImagePrompt: "A co-created visual reference.",
      imageUrl: "/generated/co-created.png",
      remoteImageUrl: "https://example.invalid/co-created.png",
    });
    await trials.updateStudyTrial({
      id: trial.id,
      coCreatedRunId: "run-co-created",
      status: "evaluating",
    });
    await assert.rejects(
      trials.claimBaselineJob(trial.id),
      trials.BaselineNotEligibleError
    );
    await evaluations.saveArtworkEvaluation({
      trialId: trial.id,
      runId: "run-co-created",
      musicMatchScore: 4,
      imaginationMatchScore: 5,
      agencyScore: 4,
      ownershipScore: 5,
      immersionScore: 4,
      satisfactionScore: 5,
    });

    await assert.rejects(
      trials.claimBaselineJob(recovered.trial.id),
      trials.BaselineNotEligibleError
    );
    const firstClaim = await trials.claimBaselineJob(trial.id);
    const duplicateClaim = await trials.claimBaselineJob(trial.id);
    assert.equal(firstClaim.acquired, true);
    assert.equal(duplicateClaim.acquired, false);
    assert.equal(
      await trials.consumeBaselineJobLease(trial.id, firstClaim.job.startedAt || ""),
      true
    );
    assert.equal(
      await trials.consumeBaselineJobLease(trial.id, firstClaim.job.startedAt || ""),
      false
    );
    await runs.insertGenerationRun(baselineRecord);
    await trials.completeBaselineJob(trial.id, "run-baseline");

    await evaluations.saveLabeledComparison({
      trialId: trial.id,
      musicMatchChoice: "co_created",
      imaginationMatchChoice: "co_created",
      overallChoice: "co_created",
      reason: "The co-created result preserved the imagined bridge.",
    });
    await evaluations.savePairwiseComparison({
      trialId: trial.id,
      leftRole: trial.comparisonOrder === "co_created_left" ? "co_created" : "direct_baseline",
      musicMatchChoice: "co_created",
      aestheticChoice: "tie",
      overallChoice: "co_created",
      reason: "Legacy blind-comparison record.",
    });
    await evaluations.saveManipulationCheck({
      trialId: trial.id,
      perspectiveMultiplicityScore: 5,
      articulationSupportScore: 4,
      dialogueExperienceScore: 5,
    });

    const restored = await trials.getStudyTrial(trial.id);
    const job = await trials.getBaselineJob(trial.id);
    const result = await runs.getGenerationRunResult("run-baseline");
    const evaluation = await evaluations.getTrialEvaluationState(trial.id);
    const exported = await exports.exportExperimentJson();
    assert.equal(restored?.baselineRunId, "run-baseline");
    assert.equal(restored?.coCreatedRunId, "run-co-created");
    assert.equal(restored?.protocolVersion, CURRENT_STUDY_PROTOCOL_VERSION);
    assert.equal(restored?.status, "completed");
    assert.equal(job?.status, "completed");
    assert.equal(result?.generationRole, "direct_baseline");
    assert.equal(result?.imageSize, "1696*960");
    assert.equal(evaluation.artwork?.ownership_score, 5);
    assert.equal(evaluation.comparison?.overall_choice, "co_created");
    assert.equal(evaluation.labeledComparison?.imagination_match_choice, "co_created");
    assert.equal(evaluation.manipulation?.articulation_support_score, 4);
    assert.equal(exported.schemaVersion, 6);
    assert.equal(exported.labeledComparisons.length, 1);
    assert.equal(exported.manipulationChecks.length, 1);
    assert.equal(exported.trials.length, 14);
    assert.equal(exported.trials.some((item) => item.id === "recovered-trial"), true);
    assert.equal(exported.runs.filter((run) => run.trial_id === trial.id).length, 2);
  } finally {
    await rm(directory, { recursive: true, force: true });
    delete process.env.MELODYVISION_DATA_DIR;
  }
});
