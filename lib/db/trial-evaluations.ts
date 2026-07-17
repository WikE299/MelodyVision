import { randomUUID } from "node:crypto";
import type { GenerationRole } from "../contracts/study-trial.ts";
import { getDatabase } from "./index.ts";
import { updateStudyTrial } from "./study-trials.ts";

export type ComparisonChoice = GenerationRole | "tie";

export async function saveArtworkEvaluation(input: {
  trialId: string;
  runId: string;
  musicMatchScore: number;
  imaginationMatchScore: number;
  agencyScore: number;
  ownershipScore: number;
  immersionScore: number;
  satisfactionScore: number;
}) {
  const database = await getDatabase();
  await database.prepare(`
    INSERT INTO artwork_evaluations (
      id, trial_id, run_id, created_at, music_match_score,
      imagination_match_score, agency_score, ownership_score,
      immersion_score, satisfaction_score
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(trial_id) DO UPDATE SET
      run_id = excluded.run_id,
      created_at = excluded.created_at,
      music_match_score = excluded.music_match_score,
      imagination_match_score = excluded.imagination_match_score,
      agency_score = excluded.agency_score,
      ownership_score = excluded.ownership_score,
      immersion_score = excluded.immersion_score,
      satisfaction_score = excluded.satisfaction_score
  `).run(
    randomUUID(),
    input.trialId,
    input.runId,
    new Date().toISOString(),
    input.musicMatchScore,
    input.imaginationMatchScore,
    input.agencyScore,
    input.ownershipScore,
    input.immersionScore,
    input.satisfactionScore
  );
  await updateStudyTrial({ id: input.trialId, status: "evaluating" });
}

export async function saveLabeledComparison(input: {
  trialId: string;
  musicMatchChoice: ComparisonChoice;
  imaginationMatchChoice: ComparisonChoice;
  overallChoice: ComparisonChoice;
  reason: string;
}) {
  const database = await getDatabase();
  await database.prepare(`
    INSERT INTO labeled_comparisons (
      id, trial_id, created_at, music_match_choice,
      imagination_match_choice, overall_choice, reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(trial_id) DO UPDATE SET
      created_at = excluded.created_at,
      music_match_choice = excluded.music_match_choice,
      imagination_match_choice = excluded.imagination_match_choice,
      overall_choice = excluded.overall_choice,
      reason = excluded.reason
  `).run(
    randomUUID(),
    input.trialId,
    new Date().toISOString(),
    input.musicMatchChoice,
    input.imaginationMatchChoice,
    input.overallChoice,
    input.reason
  );
  await updateStudyTrial({ id: input.trialId, status: "evaluating" });
}

export async function saveManipulationCheck(input: {
  trialId: string;
  perspectiveMultiplicityScore: number;
  articulationSupportScore: number;
  dialogueExperienceScore: number;
}) {
  const database = await getDatabase();
  await database.prepare(`
    INSERT INTO manipulation_checks (
      id, trial_id, created_at, perspective_multiplicity_score,
      articulation_support_score, dialogue_experience_score
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(trial_id) DO UPDATE SET
      created_at = excluded.created_at,
      perspective_multiplicity_score = excluded.perspective_multiplicity_score,
      articulation_support_score = excluded.articulation_support_score,
      dialogue_experience_score = excluded.dialogue_experience_score
  `).run(
    randomUUID(),
    input.trialId,
    new Date().toISOString(),
    input.perspectiveMultiplicityScore,
    input.articulationSupportScore,
    input.dialogueExperienceScore
  );
  await updateStudyTrial({ id: input.trialId, status: "completed" });
}

export async function savePairwiseComparison(input: {
  trialId: string;
  leftRole: GenerationRole;
  musicMatchChoice: ComparisonChoice;
  aestheticChoice: ComparisonChoice;
  overallChoice: ComparisonChoice;
  reason: string;
}) {
  const database = await getDatabase();
  const now = new Date().toISOString();
  await database.prepare(`
    INSERT INTO pairwise_comparisons (
      id, trial_id, created_at, left_role, music_match_choice,
      aesthetic_choice, overall_choice, reason, revealed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(trial_id) DO UPDATE SET
      created_at = excluded.created_at,
      left_role = excluded.left_role,
      music_match_choice = excluded.music_match_choice,
      aesthetic_choice = excluded.aesthetic_choice,
      overall_choice = excluded.overall_choice,
      reason = excluded.reason,
      revealed_at = excluded.revealed_at
  `).run(
    randomUUID(),
    input.trialId,
    now,
    input.leftRole,
    input.musicMatchChoice,
    input.aestheticChoice,
    input.overallChoice,
    input.reason,
    now
  );
  await updateStudyTrial({ id: input.trialId, status: "completed" });
}

export async function getTrialEvaluationState(trialId: string) {
  const database = await getDatabase();
  const artwork = (await database.prepare(
    "SELECT * FROM artwork_evaluations WHERE trial_id = ?"
  ).all(trialId))[0] || null;
  const comparison = (await database.prepare(
    "SELECT * FROM pairwise_comparisons WHERE trial_id = ?"
  ).all(trialId))[0] || null;
  const labeledComparison = (await database.prepare(
    "SELECT * FROM labeled_comparisons WHERE trial_id = ?"
  ).all(trialId))[0] || null;
  const manipulation = (await database.prepare(
    "SELECT * FROM manipulation_checks WHERE trial_id = ?"
  ).all(trialId))[0] || null;
  return { artwork, comparison, labeledComparison, manipulation };
}
