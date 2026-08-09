import { randomUUID } from "node:crypto";
import { CURRENT_STUDY_PROTOCOL_VERSION } from "../contracts/study-trial.ts";
import type {
  AssignmentMethod,
  BaselineJobStatus,
  ComparisonOrder,
  InteractiveCondition,
  StudyTrial,
  StudyTrialStatus,
} from "../contracts/study-trial.ts";
import { getDatabase } from "./index.ts";

interface StudyTrialRow {
  id: string;
  participant_id: string;
  session_id: string;
  study_session_id: string | null;
  period: number | null;
  stimulus_id: string;
  condition: InteractiveCondition;
  assignment_method: AssignmentMethod;
  music_profile_id: string;
  co_created_run_id: string | null;
  baseline_run_id: string | null;
  protocol_version: string;
  comparison_order: ComparisonOrder;
  status: StudyTrialStatus;
  created_at: string;
  updated_at: string;
}

function rowToTrial(row: StudyTrialRow): StudyTrial {
  return {
    id: row.id,
    participantId: row.participant_id,
    sessionId: row.session_id,
    studySessionId: row.study_session_id || null,
    period: row.period === 1 || row.period === 2 ? row.period : null,
    stimulusId: row.stimulus_id || "",
    condition: row.condition,
    assignmentMethod: row.assignment_method,
    musicProfileId: row.music_profile_id,
    coCreatedRunId: row.co_created_run_id,
    baselineRunId: row.baseline_run_id,
    protocolVersion: row.protocol_version,
    comparisonOrder: row.comparison_order,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function chooseBalancedCondition(): Promise<InteractiveCondition> {
  const database = await getDatabase();
  return chooseBalancedConditionFromDatabase(database);
}

async function chooseBalancedConditionFromDatabase(
  database: Awaited<ReturnType<typeof getDatabase>>
): Promise<InteractiveCondition> {
  const rows = await database.prepare(`
    SELECT condition, COUNT(*) AS count
    FROM study_trials
    WHERE assignment_method = 'balanced_random'
    GROUP BY condition
  `).all() as Array<{ condition: InteractiveCondition; count: number }>;
  const counts: Record<InteractiveCondition, number> = {
    multi_agent: 0,
    single_agent: 0,
  };
  for (const row of rows) counts[row.condition] = Number(row.count);
  if (counts.multi_agent === counts.single_agent) {
    return Math.random() < 0.5 ? "multi_agent" : "single_agent";
  }
  return counts.multi_agent < counts.single_agent ? "multi_agent" : "single_agent";
}

async function insertStudyTrial(
  database: Awaited<ReturnType<typeof getDatabase>>,
  input: {
    id?: string;
    participantId: string;
    sessionId: string;
    condition: InteractiveCondition;
    assignmentMethod: AssignmentMethod;
    musicProfileId: string;
    studySessionId?: string;
    period?: 1 | 2;
    stimulusId?: string;
  }
): Promise<StudyTrial> {
  const id = input.id || randomUUID();
  const now = new Date().toISOString();
  const legacyComparisonOrder: ComparisonOrder = "co_created_left";
  await database.prepare(`
    INSERT INTO study_trials (
      id, participant_id, session_id, study_session_id, period, stimulus_id,
      condition, assignment_method,
      music_profile_id, co_created_run_id, baseline_run_id,
      protocol_version, comparison_order, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, 'created', ?, ?)
  `).run(
    id,
    input.participantId,
    input.sessionId,
    input.studySessionId || null,
    input.period || null,
    input.stimulusId || "",
    input.condition,
    input.assignmentMethod,
    input.musicProfileId,
    CURRENT_STUDY_PROTOCOL_VERSION,
    legacyComparisonOrder,
    now,
    now
  );
  const row = (await database.prepare("SELECT * FROM study_trials WHERE id = ?").all(id))[0] as unknown as StudyTrialRow;
  return rowToTrial(row);
}

export async function createStudyTrial(input: {
  id?: string;
  participantId: string;
  sessionId: string;
  condition: InteractiveCondition;
  assignmentMethod: AssignmentMethod;
  musicProfileId: string;
  studySessionId?: string;
  period?: 1 | 2;
  stimulusId?: string;
}): Promise<StudyTrial> {
  const database = await getDatabase();
  return insertStudyTrial(database, input);
}

export async function createBalancedStudyTrial(input: {
  participantId: string;
  sessionId: string;
  musicProfileId: string;
}): Promise<StudyTrial> {
  const database = await getDatabase();
  return database.transaction(async (transaction) => {
    if (transaction.provider === "supabase") {
      await transaction.prepare("SELECT pg_advisory_xact_lock(?)").all(766644223);
    }
    const trial = await insertStudyTrial(transaction, {
      ...input,
      condition: await chooseBalancedConditionFromDatabase(transaction),
      assignmentMethod: "balanced_random",
    });
    return trial;
  });
}

export async function recoverStudyTrial(input: {
  id: string;
  participantId: string;
  sessionId: string;
  condition: InteractiveCondition;
  assignmentMethod: AssignmentMethod;
  musicProfileId: string;
  studySessionId?: string;
  period?: 1 | 2;
  stimulusId?: string;
}): Promise<{ trial: StudyTrial; recovered: boolean }> {
  const existing = await getStudyTrial(input.id);
  if (existing) return { trial: existing, recovered: false };

  try {
    const trial = await createStudyTrial(input);
    return { trial, recovered: true };
  } catch (error) {
    const concurrentlyRecovered = await getStudyTrial(input.id);
    if (concurrentlyRecovered) return { trial: concurrentlyRecovered, recovered: false };
    throw error;
  }
}

export async function getStudyTrial(id: string): Promise<StudyTrial | null> {
  const database = await getDatabase();
  const row = (await database.prepare("SELECT * FROM study_trials WHERE id = ?").all(id))[0] as unknown as StudyTrialRow | undefined;
  return row ? rowToTrial(row) : null;
}

export async function getStudyTrialBySessionPeriod(
  studySessionId: string,
  period: 1 | 2
): Promise<StudyTrial | null> {
  const database = await getDatabase();
  const row = (await database.prepare(`
    SELECT * FROM study_trials
    WHERE study_session_id = ? AND period = ?
  `).all(studySessionId, period))[0] as unknown as StudyTrialRow | undefined;
  return row ? rowToTrial(row) : null;
}

export async function listStudyTrialsBySession(studySessionId: string): Promise<StudyTrial[]> {
  const database = await getDatabase();
  const rows = await database.prepare(`
    SELECT * FROM study_trials
    WHERE study_session_id = ?
    ORDER BY period ASC
  `).all(studySessionId) as unknown as StudyTrialRow[];
  return rows.map(rowToTrial);
}

export async function updateStudyTrial(input: {
  id: string;
  status?: StudyTrialStatus;
  coCreatedRunId?: string;
  baselineRunId?: string;
}): Promise<StudyTrial | null> {
  const database = await getDatabase();
  const trial = await getStudyTrial(input.id);
  if (!trial) return null;
  const now = new Date().toISOString();
  await database.prepare(`
    UPDATE study_trials
    SET status = ?, co_created_run_id = ?, baseline_run_id = ?, updated_at = ?
    WHERE id = ?
  `).run(
    input.status || trial.status,
    trial.coCreatedRunId || input.coCreatedRunId || null,
    trial.baselineRunId || input.baselineRunId || null,
    now,
    input.id
  );
  return getStudyTrial(input.id);
}

export interface BaselineJob {
  trialId: string;
  status: BaselineJobStatus;
  attempts: number;
  runId: string | null;
  error: string;
  startedAt: string | null;
  updatedAt: string;
}

function mapBaselineJob(row: Record<string, unknown>): BaselineJob {
  return {
    trialId: String(row.trial_id),
    status: row.status as BaselineJobStatus,
    attempts: Number(row.attempts),
    runId: typeof row.run_id === "string" ? row.run_id : null,
    error: typeof row.error === "string" ? row.error : "",
    startedAt: typeof row.started_at === "string" ? row.started_at : null,
    updatedAt: String(row.updated_at),
  };
}

async function getBaselineJobFromDatabase(
  database: Awaited<ReturnType<typeof getDatabase>>,
  trialId: string
): Promise<BaselineJob | null> {
  const row = (await database.prepare("SELECT * FROM baseline_jobs WHERE trial_id = ?").all(trialId))[0];
  return row ? mapBaselineJob(row) : null;
}

export async function getBaselineJob(trialId: string): Promise<BaselineJob | null> {
  const database = await getDatabase();
  return getBaselineJobFromDatabase(database, trialId);
}

export class BaselineNotEligibleError extends Error {
  constructor() {
    super("Baseline requires the completed experiment checkpoint");
    this.name = "BaselineNotEligibleError";
  }
}

export async function claimBaselineJob(trialId: string): Promise<{ acquired: boolean; job: BaselineJob }> {
  const database = await getDatabase();
  return database.transaction(async (transaction) => {
    if (transaction.provider === "supabase") {
      await transaction.prepare("SELECT pg_advisory_xact_lock(hashtext(?))").all(`baseline:${trialId}`);
    }
    const current = await getBaselineJobFromDatabase(transaction, trialId);
    const now = new Date().toISOString();
    const staleBefore = Date.now() - 5 * 60 * 1000;
    if (
      current?.status === "completed" ||
      (current?.status === "running" && Date.parse(current.updatedAt) > staleBefore)
    ) {
      return { acquired: false, job: current };
    }
    const trialRow = (await transaction.prepare(
      "SELECT co_created_run_id, study_session_id FROM study_trials WHERE id = ?"
    ).all(trialId))[0];
    const evaluationRow = (await transaction.prepare(
      "SELECT run_id FROM artwork_evaluations WHERE trial_id = ?"
    ).all(trialId))[0];
    const coCreatedRunId = typeof trialRow?.co_created_run_id === "string"
      ? trialRow.co_created_run_id
      : "";
    const evaluatedRunId = typeof evaluationRow?.run_id === "string"
      ? evaluationRow.run_id
      : "";
    if (!coCreatedRunId || evaluatedRunId !== coCreatedRunId) {
      throw new BaselineNotEligibleError();
    }
    const studySessionId = typeof trialRow?.study_session_id === "string"
      ? trialRow.study_session_id
      : "";
    if (studySessionId) {
      const pairedTrials = await transaction.prepare(
        "SELECT id, co_created_run_id FROM study_trials WHERE study_session_id = ?"
      ).all(studySessionId);
      if (pairedTrials.length !== 2) throw new BaselineNotEligibleError();
      for (const pairedTrial of pairedTrials) {
        const pairedRunId = typeof pairedTrial.co_created_run_id === "string"
          ? pairedTrial.co_created_run_id
          : "";
        const pairedEvaluation = (await transaction.prepare(
          "SELECT run_id FROM artwork_evaluations WHERE trial_id = ?"
        ).all(String(pairedTrial.id)))[0];
        if (
          !pairedRunId ||
          typeof pairedEvaluation?.run_id !== "string" ||
          pairedEvaluation.run_id !== pairedRunId
        ) {
          throw new BaselineNotEligibleError();
        }
      }
    }
    if (current) {
      await transaction.prepare(`
        UPDATE baseline_jobs
        SET status = 'running', attempts = attempts + 1, error = '', started_at = ?, updated_at = ?
        WHERE trial_id = ?
      `).run(now, now, trialId);
    } else {
      await transaction.prepare(`
        INSERT INTO baseline_jobs (trial_id, status, attempts, run_id, error, started_at, updated_at)
        VALUES (?, 'running', 1, NULL, '', ?, ?)
      `).run(trialId, now, now);
    }
    return { acquired: true, job: (await getBaselineJobFromDatabase(transaction, trialId))! };
  });
}

export async function consumeBaselineJobLease(trialId: string, lease: string): Promise<boolean> {
  if (!lease) return false;
  const database = await getDatabase();
  const consumedAt = new Date().toISOString();
  const result = await database.prepare(`
    UPDATE baseline_jobs
    SET started_at = NULL, updated_at = ?
    WHERE trial_id = ? AND status = 'running' AND run_id IS NULL AND started_at = ?
  `).run(consumedAt, trialId, lease);
  return Boolean(
    result &&
    typeof result === "object" &&
    "changes" in result &&
    Number((result as { changes: unknown }).changes) === 1
  );
}

export async function completeBaselineJob(trialId: string, runId: string) {
  const database = await getDatabase();
  const now = new Date().toISOString();
  await database.prepare(`
    UPDATE baseline_jobs SET status = 'completed', run_id = ?, error = '', updated_at = ?
    WHERE trial_id = ? AND run_id IS NULL
  `).run(runId, now, trialId);
  await updateStudyTrial({ id: trialId, baselineRunId: runId });
}

export async function failBaselineJob(trialId: string, error: string) {
  const database = await getDatabase();
  await database.prepare(`
    UPDATE baseline_jobs SET status = 'failed', error = ?, updated_at = ?
    WHERE trial_id = ? AND status != 'completed'
  `).run(error.slice(0, 1000), new Date().toISOString(), trialId);
}
