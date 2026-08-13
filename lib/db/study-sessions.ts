import { randomInt, randomUUID } from "node:crypto";
import {
  CURRENT_STUDY_PROTOCOL_VERSION,
  type InteractiveCondition,
  type SessionComparisonChoice,
  type StudyPeriod,
  type StudyPeriodAssignment,
  type StudyAudioChoice,
  type StudySequence,
  type StudySession,
  type StudySessionComparison,
  type StudySessionStatus,
} from "../contracts/study-trial.ts";
import { getDatabase, toJson, type MelodyDatabase } from "./index.ts";

const SEQUENCES: StudySequence[] = [
  "single_x_then_multi_y",
  "multi_x_then_single_y",
  "single_y_then_multi_x",
  "multi_y_then_single_x",
];

interface StudySessionRow {
  id: string;
  participant_id: string;
  device_session_id: string;
  protocol_version: string;
  sequence: StudySequence;
  status: StudySessionStatus;
  current_period: number;
  stimulus_x_id: string;
  stimulus_y_id: string;
  stimulus_x_json: string | StudyAudioChoice | null;
  stimulus_y_json: string | StudyAudioChoice | null;
  selected_musician_ids_json: string | string[];
  first_trial_id: string | null;
  second_trial_id: string | null;
  assignment_block_id: string;
  assignment_position: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface AssignmentBlockRow {
  id: string;
  sequences_json: string | StudySequence[];
  next_position: number;
}

interface SessionComparisonRow {
  study_session_id: string;
  created_at: string;
  expression_support_choice: SessionComparisonChoice;
  immersion_choice: SessionComparisonChoice;
  creative_freedom_choice: SessionComparisonChoice;
  overall_choice: SessionComparisonChoice;
  reason: string;
}

function parseStringArray(value: string | string[]): string[] {
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string");
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function parseAudioChoice(value: string | StudyAudioChoice | null): StudyAudioChoice | null {
  if (!value) return null;
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" && typeof parsed.id === "string"
      ? parsed as StudyAudioChoice
      : null;
  } catch {
    return null;
  }
}

function rowToStudySession(row: StudySessionRow): StudySession {
  return {
    id: row.id,
    participantId: row.participant_id,
    deviceSessionId: row.device_session_id,
    protocolVersion: row.protocol_version,
    sequence: row.sequence,
    status: row.status,
    currentPeriod: row.current_period === 2 ? 2 : 1,
    stimulusXId: row.stimulus_x_id,
    stimulusYId: row.stimulus_y_id,
    stimulusX: parseAudioChoice(row.stimulus_x_json),
    stimulusY: parseAudioChoice(row.stimulus_y_json),
    selectedMusicianIds: parseStringArray(row.selected_musician_ids_json),
    firstTrialId: row.first_trial_id,
    secondTrialId: row.second_trial_id,
    assignmentBlockId: row.assignment_block_id,
    assignmentPosition: Number(row.assignment_position),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

function shuffleSequences(): StudySequence[] {
  const shuffled = [...SEQUENCES];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = randomInt(index + 1);
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

function parseSequences(value: string | StudySequence[]): StudySequence[] {
  const parsed = Array.isArray(value)
    ? value
    : (() => {
        try {
          return JSON.parse(value);
        } catch {
          return [];
        }
      })();
  return Array.isArray(parsed)
    ? parsed.filter((item): item is StudySequence => SEQUENCES.includes(item as StudySequence))
    : [];
}

function stimulusPairKey(stimulusXId: string, stimulusYId: string): string {
  return `${stimulusXId}::${stimulusYId}`;
}

async function claimSequence(
  database: MelodyDatabase,
  stimulusXId: string,
  stimulusYId: string
): Promise<{ sequence: StudySequence; blockId: string; position: number }> {
  const pairKey = stimulusPairKey(stimulusXId, stimulusYId);
  const current = (await database.prepare(`
    SELECT id, sequences_json, next_position
    FROM study_assignment_blocks
    WHERE protocol_version = ? AND stimulus_pair_key = ? AND next_position < 4
    ORDER BY created_at DESC
  `).all(CURRENT_STUDY_PROTOCOL_VERSION, pairKey))[0] as unknown as AssignmentBlockRow | undefined;

  let block = current;
  if (!block) {
    const id = randomUUID();
    const now = new Date().toISOString();
    const sequences = shuffleSequences();
    await database.prepare(`
      INSERT INTO study_assignment_blocks (
        id, protocol_version, stimulus_pair_key, sequences_json,
        next_position, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 0, ?, ?)
    `).run(
      id,
      CURRENT_STUDY_PROTOCOL_VERSION,
      pairKey,
      toJson(sequences),
      now,
      now
    );
    block = { id, sequences_json: sequences, next_position: 0 };
  }

  const sequences = parseSequences(block.sequences_json);
  const position = Number(block.next_position);
  const sequence = sequences[position];
  if (!sequence) throw new Error("Study assignment block is invalid");

  await database.prepare(`
    UPDATE study_assignment_blocks
    SET next_position = ?, updated_at = ?
    WHERE id = ? AND next_position = ?
  `).run(position + 1, new Date().toISOString(), block.id, position);

  return { sequence, blockId: block.id, position };
}

export function getStudyPeriodAssignment(
  session: StudySession,
  period: StudyPeriod
): StudyPeriodAssignment {
  const assignments: Record<StudySequence, [InteractiveCondition, string, InteractiveCondition, string]> = {
    single_x_then_multi_y: ["single_agent", session.stimulusXId, "multi_agent", session.stimulusYId],
    multi_x_then_single_y: ["multi_agent", session.stimulusXId, "single_agent", session.stimulusYId],
    single_y_then_multi_x: ["single_agent", session.stimulusYId, "multi_agent", session.stimulusXId],
    multi_y_then_single_x: ["multi_agent", session.stimulusYId, "single_agent", session.stimulusXId],
  };
  const [firstCondition, firstStimulus, secondCondition, secondStimulus] = assignments[session.sequence];
  return period === 1
    ? {
        period,
        condition: firstCondition,
        stimulusId: firstStimulus,
        trialId: session.firstTrialId,
      }
    : {
        period,
        condition: secondCondition,
        stimulusId: secondStimulus,
        trialId: session.secondTrialId,
      };
}

export async function createOrRecoverStudySession(input: {
  participantId: string;
  deviceSessionId: string;
  stimulusXId: string;
  stimulusYId: string;
}): Promise<{ session: StudySession; recovered: boolean }> {
  const database = await getDatabase();
  return database.transaction(async (transaction) => {
    if (transaction.provider === "supabase") {
      await transaction.prepare("SELECT pg_advisory_xact_lock(hashtext(?))")
        .all(`study-session:${CURRENT_STUDY_PROTOCOL_VERSION}:${input.participantId}`);
      await transaction.prepare("SELECT pg_advisory_xact_lock(hashtext(?))")
        .all(
          `study-assignment:${CURRENT_STUDY_PROTOCOL_VERSION}:${stimulusPairKey(
            input.stimulusXId,
            input.stimulusYId
          )}`
        );
    }

    const existing = (await transaction.prepare(`
      SELECT * FROM study_sessions
      WHERE participant_id = ? AND protocol_version = ?
      ORDER BY created_at DESC
    `).all(input.participantId, CURRENT_STUDY_PROTOCOL_VERSION))[0] as unknown as StudySessionRow | undefined;
    if (existing) return { session: rowToStudySession(existing), recovered: true };

    const assignment = await claimSequence(transaction, "participant-choice-x", "participant-choice-y");
    const id = randomUUID();
    const now = new Date().toISOString();
    await transaction.prepare(`
      INSERT INTO study_sessions (
        id, participant_id, device_session_id, protocol_version, sequence,
        status, current_period, stimulus_x_id, stimulus_y_id,
        selected_musician_ids_json, first_trial_id, second_trial_id,
        assignment_block_id, assignment_position, created_at, updated_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, 'created', 1, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, NULL)
    `).run(
      id,
      input.participantId,
      input.deviceSessionId,
      CURRENT_STUDY_PROTOCOL_VERSION,
      assignment.sequence,
      "",
      "",
      toJson([]),
      assignment.blockId,
      assignment.position,
      now,
      now
    );
    const row = (await transaction.prepare("SELECT * FROM study_sessions WHERE id = ?")
      .all(id))[0] as unknown as StudySessionRow;
    return { session: rowToStudySession(row), recovered: false };
  });
}

export async function getStudySession(id: string): Promise<StudySession | null> {
  const database = await getDatabase();
  const row = (await database.prepare("SELECT * FROM study_sessions WHERE id = ?")
    .all(id))[0] as unknown as StudySessionRow | undefined;
  return row ? rowToStudySession(row) : null;
}

export async function updateStudySession(input: {
  id: string;
  status?: StudySessionStatus;
  currentPeriod?: StudyPeriod;
  selectedMusicianIds?: string[];
  firstTrialId?: string;
  secondTrialId?: string;
  completed?: boolean;
}): Promise<StudySession | null> {
  const database = await getDatabase();
  return database.transaction(async (transaction) => {
    const row = (await transaction.prepare("SELECT * FROM study_sessions WHERE id = ?")
      .all(input.id))[0] as unknown as StudySessionRow | undefined;
    if (!row) return null;
    const session = rowToStudySession(row);
    const now = new Date().toISOString();
    await transaction.prepare(`
      UPDATE study_sessions
      SET status = ?, current_period = ?, selected_musician_ids_json = ?,
          first_trial_id = ?, second_trial_id = ?, updated_at = ?, completed_at = ?
      WHERE id = ?
    `).run(
      input.status || session.status,
      input.currentPeriod || session.currentPeriod,
      toJson(input.selectedMusicianIds || session.selectedMusicianIds),
      input.firstTrialId || session.firstTrialId,
      input.secondTrialId || session.secondTrialId,
      now,
      input.completed ? now : session.completedAt,
      input.id
    );
    const updated = (await transaction.prepare("SELECT * FROM study_sessions WHERE id = ?")
      .all(input.id))[0] as unknown as StudySessionRow;
    return rowToStudySession(updated);
  });
}

export async function saveStudyAudioChoices(input: {
  studySessionId: string;
  first: StudyAudioChoice;
  second: StudyAudioChoice;
}): Promise<StudySession | null> {
  if (input.first.id === input.second.id) {
    throw new Error("Two different study audio choices are required");
  }
  const database = await getDatabase();
  const session = await getStudySession(input.studySessionId);
  if (!session) return null;
  if (session.firstTrialId || session.secondTrialId) {
    throw new Error("Study audio choices cannot change after the experience starts");
  }
  const now = new Date().toISOString();
  await database.prepare(`
    UPDATE study_sessions
    SET stimulus_x_id = ?, stimulus_y_id = ?, stimulus_x_json = ?, stimulus_y_json = ?, updated_at = ?
    WHERE id = ?
  `).run(
    input.first.id,
    input.second.id,
    toJson(input.first),
    toJson(input.second),
    now,
    input.studySessionId
  );
  return getStudySession(input.studySessionId);
}

export async function attachTrialToStudySession(input: {
  studySessionId: string;
  period: StudyPeriod;
  trialId: string;
}): Promise<StudySession | null> {
  return updateStudySession({
    id: input.studySessionId,
    status: input.period === 1 ? "period_1" : "period_2",
    currentPeriod: input.period,
    ...(input.period === 1
      ? { firstTrialId: input.trialId }
      : { secondTrialId: input.trialId }),
  });
}

export async function completeStudyPeriod(input: {
  studySessionId: string;
  period: StudyPeriod;
}): Promise<StudySession | null> {
  return updateStudySession({
    id: input.studySessionId,
    status: input.period === 1 ? "between_periods" : "comparing",
    currentPeriod: input.period === 1 ? 2 : 2,
  });
}

export async function saveStudySessionComparison(input: {
  studySessionId: string;
  expressionSupportChoice: SessionComparisonChoice;
  immersionChoice: SessionComparisonChoice;
  creativeFreedomChoice: SessionComparisonChoice;
  overallChoice: SessionComparisonChoice;
  reason: string;
}): Promise<StudySessionComparison> {
  const database = await getDatabase();
  const now = new Date().toISOString();
  await database.prepare(`
    INSERT INTO session_comparisons (
      id, study_session_id, created_at, expression_support_choice,
      immersion_choice, creative_freedom_choice, overall_choice, reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(study_session_id) DO UPDATE SET
      created_at = excluded.created_at,
      expression_support_choice = excluded.expression_support_choice,
      immersion_choice = excluded.immersion_choice,
      creative_freedom_choice = excluded.creative_freedom_choice,
      overall_choice = excluded.overall_choice,
      reason = excluded.reason
  `).run(
    randomUUID(),
    input.studySessionId,
    now,
    input.expressionSupportChoice,
    input.immersionChoice,
    input.creativeFreedomChoice,
    input.overallChoice,
    input.reason
  );
  await updateStudySession({
    id: input.studySessionId,
    status: "baseline_review",
  });
  return {
    ...input,
    createdAt: now,
  };
}

export async function getStudySessionComparison(
  studySessionId: string
): Promise<StudySessionComparison | null> {
  const database = await getDatabase();
  const row = (await database.prepare(
    "SELECT * FROM session_comparisons WHERE study_session_id = ?"
  ).all(studySessionId))[0] as unknown as SessionComparisonRow | undefined;
  if (!row) return null;
  return {
    studySessionId: row.study_session_id,
    expressionSupportChoice: row.expression_support_choice,
    immersionChoice: row.immersion_choice,
    creativeFreedomChoice: row.creative_freedom_choice,
    overallChoice: row.overall_choice,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

export async function getStudySessionTrials(studySessionId: string) {
  const database = await getDatabase();
  return database.prepare(`
    SELECT * FROM study_trials
    WHERE study_session_id = ?
    ORDER BY period ASC
  `).all(studySessionId);
}
