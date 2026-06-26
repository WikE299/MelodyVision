import { mkdir } from "node:fs/promises";
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

interface SQLiteModule {
  DatabaseSync: new (path: string) => SQLiteDatabase;
}

let databasePromise: Promise<SQLiteDatabase> | null = null;

async function loadSQLite(): Promise<SQLiteModule> {
  const moduleName = "node:sqlite";
  return (await import(moduleName)) as SQLiteModule;
}

async function createDatabase(): Promise<SQLiteDatabase> {
  const dataDirectory = path.join(process.cwd(), "data");
  await mkdir(dataDirectory, { recursive: true });

  const sqlite = await loadSQLite();
  const database = new sqlite.DatabaseSync(path.join(dataDirectory, "melodyvision.sqlite"));
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

    CREATE INDEX IF NOT EXISTS idx_generation_runs_session
      ON generation_runs(session_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_generation_feedback_run
      ON generation_feedback(run_id, created_at);
  `);

  return database;
}

export function getDatabase(): Promise<SQLiteDatabase> {
  databasePromise ||= createDatabase();
  return databasePromise;
}

export function toJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}
