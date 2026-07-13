import { mkdir } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";

type SQLiteValue = string | number | bigint | null;

interface SQLiteStatement {
  run(...values: SQLiteValue[]): unknown;
  all(...values: SQLiteValue[]): Record<string, unknown>[];
}

interface SQLiteDatabase {
  exec(sql: string): void;
  prepare(sql: string): SQLiteStatement;
}

let databasePromise: Promise<SQLiteDatabase> | null = null;

function ensureColumn(
  database: SQLiteDatabase,
  table: string,
  column: string,
  definition: string
) {
  const columns = database.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((item) => item.name === column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  }
}

async function createDatabase(): Promise<SQLiteDatabase> {
  const dataDirectory = path.join(process.cwd(), "data");
  await mkdir(dataDirectory, { recursive: true });

  const database = new DatabaseSync(path.join(dataDirectory, "melodyvision.sqlite"));
  database.exec("PRAGMA journal_mode = WAL;");
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec(`
    CREATE TABLE IF NOT EXISTS generation_runs (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      selected_characters_json TEXT NOT NULL,
      presets_json TEXT NOT NULL,
      user_note TEXT NOT NULL,
      music_analysis_json TEXT NOT NULL,
      music_profile_json TEXT NOT NULL DEFAULT 'null',
      conversation_state_json TEXT NOT NULL DEFAULT 'null',
      visual_brief_json TEXT NOT NULL DEFAULT 'null',
      musician_comments_json TEXT NOT NULL,
      prompt_director_json TEXT NOT NULL,
      final_image_prompt TEXT NOT NULL,
      negative_prompt TEXT NOT NULL,
      image_url TEXT NOT NULL,
      remote_image_url TEXT NOT NULL,
      image_provider TEXT NOT NULL,
      image_model TEXT NOT NULL,
      image_request_id TEXT NOT NULL,
      timings_json TEXT NOT NULL,
      log_path TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS generation_feedback (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      music_match_score INTEGER NOT NULL,
      comment_match_score INTEGER NOT NULL,
      aesthetic_score INTEGER NOT NULL,
      selected_reasons_json TEXT NOT NULL,
      free_text TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES generation_runs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS experiment_sessions (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      metadata_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audio_analyses (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      mode TEXT NOT NULL,
      source_kind TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      music_profile_json TEXT NOT NULL,
      compatibility_analysis_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversation_snapshots (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      conversation_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      reason TEXT NOT NULL,
      state_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS visual_brief_versions (
      id TEXT PRIMARY KEY,
      brief_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      session_id TEXT NOT NULL,
      conversation_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      brief_json TEXT NOT NULL,
      meta_json TEXT NOT NULL,
      UNIQUE(brief_id, version)
    );

    CREATE TABLE IF NOT EXISTS interaction_events (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      event_type TEXT NOT NULL,
      page TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_generation_runs_session
      ON generation_runs(session_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_generation_feedback_run
      ON generation_feedback(run_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_audio_analyses_session
      ON audio_analyses(session_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_conversation_snapshots_session
      ON conversation_snapshots(session_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_visual_brief_versions_session
      ON visual_brief_versions(session_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_interaction_events_session
      ON interaction_events(session_id, created_at);
  `);

  ensureColumn(database, "generation_runs", "music_profile_json", "TEXT NOT NULL DEFAULT 'null'");
  ensureColumn(database, "generation_runs", "conversation_state_json", "TEXT NOT NULL DEFAULT 'null'");
  ensureColumn(database, "generation_runs", "visual_brief_json", "TEXT NOT NULL DEFAULT 'null'");
  ensureColumn(database, "generation_runs", "image_size", "TEXT NOT NULL DEFAULT ''");

  return database;
}

export function getDatabase(): Promise<SQLiteDatabase> {
  databasePromise ||= createDatabase();
  return databasePromise;
}

export function toJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}
