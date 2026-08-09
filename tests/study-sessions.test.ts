import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

test("within-subject sessions balance four sequences and preserve paired progress", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "melodyvision-crossover-"));
  process.env.MELODYVISION_DATA_DIR = directory;
  try {
    const sessions = await import("../lib/db/study-sessions.ts");
    const trials = await import("../lib/db/study-trials.ts");
    const evaluations = await import("../lib/db/trial-evaluations.ts");

    const assigned = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        sessions.createOrRecoverStudySession({
          participantId: `participant-${index}`,
          deviceSessionId: `device-${index}`,
          stimulusXId: "track-x",
          stimulusYId: "track-y",
        })
      )
    );
    const sequenceCounts = new Map<string, number>();
    for (const item of assigned) {
      sequenceCounts.set(
        item.session.sequence,
        (sequenceCounts.get(item.session.sequence) || 0) + 1
      );
    }
    assert.deepEqual([...sequenceCounts.values()].sort(), [2, 2, 2, 2]);
    assert.ok(assigned.every((item) => item.recovered === false));

    const recovered = await sessions.createOrRecoverStudySession({
      participantId: "participant-0",
      deviceSessionId: "another-device",
      stimulusXId: "track-x",
      stimulusYId: "track-y",
    });
    assert.equal(recovered.recovered, true);
    assert.equal(recovered.session.id, assigned[0].session.id);

    const studySession = assigned[0].session;
    const firstAssignment = sessions.getStudyPeriodAssignment(studySession, 1);
    const secondAssignment = sessions.getStudyPeriodAssignment(studySession, 2);
    assert.notEqual(firstAssignment.condition, secondAssignment.condition);
    assert.notEqual(firstAssignment.stimulusId, secondAssignment.stimulusId);

    const firstTrial = await trials.createStudyTrial({
      participantId: studySession.participantId,
      sessionId: studySession.deviceSessionId,
      studySessionId: studySession.id,
      period: 1,
      stimulusId: firstAssignment.stimulusId,
      condition: firstAssignment.condition,
      assignmentMethod: "crossover_block",
      musicProfileId: "profile-1",
    });
    await sessions.attachTrialToStudySession({
      studySessionId: studySession.id,
      period: 1,
      trialId: firstTrial.id,
    });
    await sessions.updateStudySession({
      id: studySession.id,
      selectedMusicianIds: ["beethoven", "armstrong"],
    });
    await sessions.completeStudyPeriod({ studySessionId: studySession.id, period: 1 });

    const secondTrial = await trials.createStudyTrial({
      participantId: studySession.participantId,
      sessionId: studySession.deviceSessionId,
      studySessionId: studySession.id,
      period: 2,
      stimulusId: secondAssignment.stimulusId,
      condition: secondAssignment.condition,
      assignmentMethod: "crossover_block",
      musicProfileId: "profile-2",
    });
    await sessions.attachTrialToStudySession({
      studySessionId: studySession.id,
      period: 2,
      trialId: secondTrial.id,
    });
    await sessions.completeStudyPeriod({ studySessionId: studySession.id, period: 2 });

    const beforeComparison = await sessions.getStudySession(studySession.id);
    assert.equal(beforeComparison?.status, "comparing");
    assert.equal(beforeComparison?.firstTrialId, firstTrial.id);
    assert.equal(beforeComparison?.secondTrialId, secondTrial.id);
    assert.deepEqual(beforeComparison?.selectedMusicianIds, ["beethoven", "armstrong"]);

    await trials.updateStudyTrial({
      id: firstTrial.id,
      coCreatedRunId: "co-created-period-1",
      status: "evaluating",
    });
    await evaluations.saveArtworkEvaluation({
      trialId: firstTrial.id,
      runId: "co-created-period-1",
      musicMatchScore: 4,
      imaginationMatchScore: 4,
      agencyScore: 4,
      ownershipScore: 4,
      immersionScore: 4,
      satisfactionScore: 4,
    });
    await assert.rejects(
      trials.claimBaselineJob(firstTrial.id),
      trials.BaselineNotEligibleError
    );

    await trials.updateStudyTrial({
      id: secondTrial.id,
      coCreatedRunId: "co-created-period-2",
      status: "evaluating",
    });
    await evaluations.saveArtworkEvaluation({
      trialId: secondTrial.id,
      runId: "co-created-period-2",
      musicMatchScore: 4,
      imaginationMatchScore: 4,
      agencyScore: 4,
      ownershipScore: 4,
      immersionScore: 4,
      satisfactionScore: 4,
    });
    const baselineClaim = await trials.claimBaselineJob(firstTrial.id);
    assert.equal(baselineClaim.acquired, true);

    await sessions.saveStudySessionComparison({
      studySessionId: studySession.id,
      expressionSupportChoice: "period_2",
      immersionChoice: "period_2",
      creativeFreedomChoice: "period_1",
      overallChoice: "period_2",
      reason: "The second experience helped the image take shape.",
    });
    const awaitingBaselineReview = await sessions.getStudySession(studySession.id);
    const comparison = await sessions.getStudySessionComparison(studySession.id);
    assert.equal(awaitingBaselineReview?.status, "baseline_review");
    assert.equal(awaitingBaselineReview?.completedAt, null);
    await sessions.updateStudySession({
      id: studySession.id,
      status: "completed",
      completed: true,
    });
    const completed = await sessions.getStudySession(studySession.id);
    assert.equal(completed?.status, "completed");
    assert.ok(completed?.completedAt);
    assert.equal(comparison?.overallChoice, "period_2");
  } finally {
    await rm(directory, { recursive: true, force: true });
    delete process.env.MELODYVISION_DATA_DIR;
  }
});
