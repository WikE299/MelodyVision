import { randomUUID } from "node:crypto";
import type { ConversationState, VisualBrief } from "../contracts";
import { getDatabase, toJson } from "./index";

export async function upsertExperimentSession(input: {
  id: string;
  createdAt: string;
  metadata?: unknown;
}) {
  const database = await getDatabase();
  await database.prepare(`
    INSERT INTO experiment_sessions (id, created_at, updated_at, metadata_json)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at
  `).run(input.id, input.createdAt, input.createdAt, toJson(input.metadata || {}));
}

export async function insertAudioAnalysis(input: {
  sessionId: string;
  mode: string;
  sourceKind: string;
  fileName: string;
  fileSize: number;
  musicProfile: unknown;
  compatibilityAnalysis: unknown;
  createdAt?: string;
}) {
  const database = await getDatabase();
  const createdAt = input.createdAt || new Date().toISOString();
  const id = randomUUID();
  await database.prepare(`
    INSERT INTO audio_analyses (
      id, session_id, created_at, mode, source_kind, file_name, file_size,
      music_profile_json, compatibility_analysis_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.sessionId,
    createdAt,
    input.mode,
    input.sourceKind,
    input.fileName,
    input.fileSize,
    toJson(input.musicProfile),
    toJson(input.compatibilityAnalysis)
  );
  return id;
}

export async function attachAudioAnalysisToTrial(input: {
  sessionId: string;
  trialId: string;
  musicProfileId: string;
}) {
  const database = await getDatabase();
  const candidates = await database.prepare(`
    SELECT id, music_profile_json
    FROM audio_analyses
    WHERE session_id = ? AND trial_id = ''
    ORDER BY created_at DESC
  `).all(input.sessionId);
  const match = candidates.find((row) => {
    if (typeof row.music_profile_json !== "string") return false;
    try {
      return JSON.parse(row.music_profile_json)?.id === input.musicProfileId;
    } catch {
      return false;
    }
  });
  if (!match || typeof match.id !== "string") return false;
  await database.prepare("UPDATE audio_analyses SET trial_id = ? WHERE id = ?")
    .run(input.trialId, match.id);
  return true;
}

export async function insertConversationSnapshot(
  state: ConversationState,
  reason: string,
  createdAt = new Date().toISOString()
) {
  const database = await getDatabase();
  await database.prepare(`
    INSERT INTO conversation_snapshots (
      id, trial_id, session_id, conversation_id, created_at, reason, state_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), state.trialId, state.sessionId, state.id, createdAt, reason, toJson(state));
}

export async function insertVisualBriefVersion(input: {
  trialId?: string;
  sessionId: string;
  brief: VisualBrief;
  meta?: unknown;
  createdAt?: string;
}) {
  const database = await getDatabase();
  const createdAt = input.createdAt || new Date().toISOString();
  await database.prepare(`
    INSERT INTO visual_brief_versions (
      id, trial_id, brief_id, version, session_id, conversation_id, created_at, brief_json, meta_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(brief_id, version) DO UPDATE SET
      brief_json = excluded.brief_json,
      meta_json = excluded.meta_json
  `).run(
    randomUUID(),
    input.trialId || "",
    input.brief.id,
    input.brief.version,
    input.sessionId,
    input.brief.conversationId,
    createdAt,
    toJson(input.brief),
    toJson(input.meta || {})
  );
}

export async function insertInteractionEvent(input: {
  trialId?: string;
  sessionId: string;
  eventType: string;
  page: string;
  payload?: unknown;
  createdAt?: string;
}) {
  const database = await getDatabase();
  await database.prepare(`
    INSERT INTO interaction_events (
      id, trial_id, session_id, created_at, event_type, page, payload_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(),
    input.trialId || "",
    input.sessionId,
    input.createdAt || new Date().toISOString(),
    input.eventType,
    input.page,
    toJson(input.payload || {})
  );
}
