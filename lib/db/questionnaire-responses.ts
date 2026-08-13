import { randomUUID } from "node:crypto";
import type {
  GenerationRole,
  InteractiveCondition,
  StudyPeriod,
} from "../contracts/study-trial.ts";
import type {
  QuestionnaireAnswers,
  QuestionnaireInstrument,
  QuestionnaireResponse,
  QuestionnaireResponseStatus,
  QuestionnaireScope,
} from "../questionnaires/index.ts";
import { getDatabase, toJson } from "./index.ts";

interface QuestionnaireResponseRow {
  id: string;
  response_key: string;
  participant_id: string;
  study_session_id: string;
  trial_id: string | null;
  run_id: string | null;
  period: number | null;
  condition: InteractiveCondition | null;
  generation_role: GenerationRole | null;
  instrument: QuestionnaireInstrument;
  questionnaire_version: string;
  scope: QuestionnaireScope;
  status: QuestionnaireResponseStatus;
  answers_json: string | QuestionnaireAnswers;
  score_total: number | null;
  metrics_json: string | Record<string, number>;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
}

function parseObject<T extends object>(value: string | T): T {
  if (typeof value !== "string") return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as T
      : {} as T;
  } catch {
    return {} as T;
  }
}

function rowToResponse(row: QuestionnaireResponseRow): QuestionnaireResponse {
  return {
    id: row.id,
    responseKey: row.response_key,
    participantId: row.participant_id,
    studySessionId: row.study_session_id,
    trialId: row.trial_id,
    runId: row.run_id,
    period: row.period === 1 || row.period === 2 ? row.period : null,
    condition: row.condition,
    generationRole: row.generation_role,
    instrument: row.instrument,
    questionnaireVersion: row.questionnaire_version,
    scope: row.scope,
    status: row.status,
    answers: parseObject<QuestionnaireAnswers>(row.answers_json),
    totalScore: row.score_total === null ? null : Number(row.score_total),
    metrics: parseObject<Record<string, number>>(row.metrics_json),
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

export async function listQuestionnaireResponses(
  studySessionId: string
): Promise<QuestionnaireResponse[]> {
  const database = await getDatabase();
  const rows = await database.prepare(`
    SELECT * FROM questionnaire_responses
    WHERE study_session_id = ?
    ORDER BY started_at ASC
  `).all(studySessionId) as unknown as QuestionnaireResponseRow[];
  return rows.map(rowToResponse);
}

export async function getQuestionnaireResponse(
  studySessionId: string,
  responseKey: string
): Promise<QuestionnaireResponse | null> {
  const database = await getDatabase();
  const row = (await database.prepare(
    "SELECT * FROM questionnaire_responses WHERE study_session_id = ? AND response_key = ?"
  ).all(studySessionId, responseKey))[0] as unknown as QuestionnaireResponseRow | undefined;
  return row ? rowToResponse(row) : null;
}

export async function upsertQuestionnaireResponse(input: {
  responseKey: string;
  participantId: string;
  studySessionId: string;
  trialId: string | null;
  runId: string | null;
  period: StudyPeriod | null;
  condition: InteractiveCondition | null;
  generationRole: GenerationRole | null;
  instrument: QuestionnaireInstrument;
  questionnaireVersion: string;
  scope: QuestionnaireScope;
  status: QuestionnaireResponseStatus;
  answers: QuestionnaireAnswers;
  totalScore: number | null;
  metrics: Record<string, number>;
}): Promise<QuestionnaireResponse> {
  const database = await getDatabase();
  return database.transaction(async (transaction) => {
    const existingRow = (await transaction.prepare(
      "SELECT * FROM questionnaire_responses WHERE study_session_id = ? AND response_key = ?"
    ).all(input.studySessionId, input.responseKey))[0] as unknown as QuestionnaireResponseRow | undefined;
    const existing = existingRow ? rowToResponse(existingRow) : null;
    if (existing?.status === "completed" && input.status === "draft") return existing;

    const now = new Date().toISOString();
    const completedAt = input.status === "completed"
      ? existing?.completedAt || now
      : null;
    await transaction.prepare(`
      INSERT INTO questionnaire_responses (
        id, response_key, participant_id, study_session_id, trial_id, run_id,
        period, condition, generation_role, instrument, questionnaire_version,
        scope, status, answers_json, score_total, metrics_json,
        started_at, updated_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(study_session_id, response_key) DO UPDATE SET
        status = excluded.status,
        answers_json = excluded.answers_json,
        score_total = excluded.score_total,
        metrics_json = excluded.metrics_json,
        updated_at = excluded.updated_at,
        completed_at = excluded.completed_at
    `).run(
      existing?.id || randomUUID(),
      input.responseKey,
      input.participantId,
      input.studySessionId,
      input.trialId,
      input.runId,
      input.period,
      input.condition,
      input.generationRole,
      input.instrument,
      input.questionnaireVersion,
      input.scope,
      input.status,
      toJson(input.answers),
      input.totalScore,
      toJson(input.metrics),
      existing?.startedAt || now,
      now,
      completedAt
    );
    const saved = (await transaction.prepare(
      "SELECT * FROM questionnaire_responses WHERE study_session_id = ? AND response_key = ?"
    ).all(input.studySessionId, input.responseKey))[0] as unknown as QuestionnaireResponseRow;
    return rowToResponse(saved);
  });
}
