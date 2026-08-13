import { mkdir } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import postgres from "postgres";

export type DatabaseValue = string | number | bigint | boolean | null;

export interface DatabaseStatement {
  run(...values: DatabaseValue[]): Promise<unknown>;
  all(...values: DatabaseValue[]): Promise<Record<string, unknown>[]>;
}

export interface MelodyDatabase {
  provider: "sqlite" | "supabase";
  exec(sql: string): Promise<void>;
  prepare(sql: string): DatabaseStatement;
  transaction<T>(callback: (database: MelodyDatabase) => Promise<T>): Promise<T>;
}

interface LocalSQLiteStatement {
  run(...values: DatabaseValue[]): unknown;
  all(...values: DatabaseValue[]): Record<string, unknown>[];
}

interface LocalSQLiteDatabase {
  exec(sql: string): void;
  prepare(sql: string): LocalSQLiteStatement;
}

type PostgresExecutor = postgres.Sql | postgres.TransactionSql;

let databasePromise: Promise<MelodyDatabase> | null = null;

function ensureColumn(
  database: LocalSQLiteDatabase,
  table: string,
  column: string,
  definition: string
) {
  const columns = database.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((item) => item.name === column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  }
}

function wrapSQLiteDatabase(database: LocalSQLiteDatabase): MelodyDatabase {
  let transactionQueue = Promise.resolve();
  const wrapped: MelodyDatabase = {
    provider: "sqlite",
    async exec(sql) {
      database.exec(sql);
    },
    prepare(sql) {
      const statement = database.prepare(sql);
      return {
        async run(...values) {
          return statement.run(...values);
        },
        async all(...values) {
          return statement.all(...values);
        },
      };
    },
    async transaction(callback) {
      const execute = async () => {
        database.exec("BEGIN IMMEDIATE;");
        try {
          const result = await callback(wrapped);
          database.exec("COMMIT;");
          return result;
        } catch (error) {
          database.exec("ROLLBACK;");
          throw error;
        }
      };
      const result = transactionQueue.then(execute, execute);
      transactionQueue = result.then(() => undefined, () => undefined);
      return result;
    },
  };
  return wrapped;
}

function replacePlaceholders(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function wrapPostgresDatabase(
  executor: PostgresExecutor,
  root: postgres.Sql
): MelodyDatabase {
  return {
    provider: "supabase",
    async exec(sql) {
      await executor.unsafe(sql);
    },
    prepare(sql) {
      const query = replacePlaceholders(sql);
      return {
        async run(...values) {
          const rows = await executor.unsafe(query, values as never[]);
          return { changes: rows.count };
        },
        async all(...values) {
          const rows = await executor.unsafe(query, values as never[]);
          return Array.from(rows) as Record<string, unknown>[];
        },
      };
    },
    async transaction(callback) {
      return root.begin((transaction) =>
        callback(wrapPostgresDatabase(transaction, root))
      ) as Promise<Awaited<ReturnType<typeof callback>>>;
    },
  };
}

async function createSQLiteDatabase(): Promise<MelodyDatabase> {
  const dataDirectory = process.env.MELODYVISION_DATA_DIR?.trim() || path.join(process.cwd(), "data");
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
      run_log_json TEXT NOT NULL DEFAULT '{}',
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
      trial_id TEXT NOT NULL DEFAULT '',
      session_id TEXT NOT NULL,
      conversation_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      reason TEXT NOT NULL,
      state_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS visual_brief_versions (
      id TEXT PRIMARY KEY,
      trial_id TEXT NOT NULL DEFAULT '',
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
      trial_id TEXT NOT NULL DEFAULT '',
      session_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      event_type TEXT NOT NULL,
      page TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS study_trials (
      id TEXT PRIMARY KEY,
      participant_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      study_session_id TEXT,
      period INTEGER,
      stimulus_id TEXT NOT NULL DEFAULT '',
      condition TEXT NOT NULL,
      assignment_method TEXT NOT NULL,
      music_profile_id TEXT NOT NULL,
      co_created_run_id TEXT,
      baseline_run_id TEXT,
      protocol_version TEXT NOT NULL DEFAULT 'v2-14-labeled-comparison',
      comparison_order TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS study_assignment_blocks (
      id TEXT PRIMARY KEY,
      protocol_version TEXT NOT NULL,
      stimulus_pair_key TEXT NOT NULL,
      sequences_json TEXT NOT NULL,
      next_position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS study_sessions (
      id TEXT PRIMARY KEY,
      participant_id TEXT NOT NULL,
      device_session_id TEXT NOT NULL,
      protocol_version TEXT NOT NULL,
      sequence TEXT NOT NULL,
      status TEXT NOT NULL,
      current_period INTEGER NOT NULL DEFAULT 1,
      stimulus_x_id TEXT NOT NULL,
      stimulus_y_id TEXT NOT NULL,
      stimulus_x_json TEXT NOT NULL DEFAULT 'null',
      stimulus_y_json TEXT NOT NULL DEFAULT 'null',
      selected_musician_ids_json TEXT NOT NULL DEFAULT '[]',
      first_trial_id TEXT,
      second_trial_id TEXT,
      assignment_block_id TEXT NOT NULL,
      assignment_position INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS session_comparisons (
      id TEXT PRIMARY KEY,
      study_session_id TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      expression_support_choice TEXT NOT NULL,
      immersion_choice TEXT NOT NULL,
      creative_freedom_choice TEXT NOT NULL,
      overall_choice TEXT NOT NULL,
      reason TEXT NOT NULL,
      FOREIGN KEY (study_session_id) REFERENCES study_sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS baseline_jobs (
      trial_id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      run_id TEXT,
      error TEXT NOT NULL DEFAULT '',
      started_at TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (trial_id) REFERENCES study_trials(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS artwork_evaluations (
      id TEXT PRIMARY KEY,
      trial_id TEXT NOT NULL,
      run_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      music_match_score INTEGER NOT NULL,
      imagination_match_score INTEGER NOT NULL,
      agency_score INTEGER NOT NULL,
      ownership_score INTEGER NOT NULL,
      immersion_score INTEGER NOT NULL,
      satisfaction_score INTEGER NOT NULL,
      FOREIGN KEY (trial_id) REFERENCES study_trials(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS pairwise_comparisons (
      id TEXT PRIMARY KEY,
      trial_id TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      left_role TEXT NOT NULL,
      music_match_choice TEXT NOT NULL,
      aesthetic_choice TEXT NOT NULL,
      overall_choice TEXT NOT NULL,
      reason TEXT NOT NULL,
      revealed_at TEXT,
      FOREIGN KEY (trial_id) REFERENCES study_trials(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS labeled_comparisons (
      id TEXT PRIMARY KEY,
      trial_id TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      music_match_choice TEXT NOT NULL,
      imagination_match_choice TEXT NOT NULL,
      overall_choice TEXT NOT NULL,
      reason TEXT NOT NULL,
      FOREIGN KEY (trial_id) REFERENCES study_trials(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS manipulation_checks (
      id TEXT PRIMARY KEY,
      trial_id TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      perspective_multiplicity_score INTEGER NOT NULL,
      articulation_support_score INTEGER NOT NULL,
      dialogue_experience_score INTEGER NOT NULL,
      FOREIGN KEY (trial_id) REFERENCES study_trials(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS questionnaire_responses (
      id TEXT PRIMARY KEY,
      response_key TEXT NOT NULL,
      participant_id TEXT NOT NULL,
      study_session_id TEXT NOT NULL,
      trial_id TEXT,
      run_id TEXT,
      period INTEGER,
      condition TEXT,
      generation_role TEXT,
      instrument TEXT NOT NULL,
      questionnaire_version TEXT NOT NULL,
      scope TEXT NOT NULL,
      status TEXT NOT NULL,
      answers_json TEXT NOT NULL,
      score_total REAL,
      metrics_json TEXT NOT NULL,
      started_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT,
      FOREIGN KEY (study_session_id) REFERENCES study_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (trial_id) REFERENCES study_trials(id) ON DELETE CASCADE,
      UNIQUE(study_session_id, response_key)
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

    CREATE INDEX IF NOT EXISTS idx_study_trials_session
      ON study_trials(session_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_study_trials_participant
      ON study_trials(participant_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_study_sessions_participant
      ON study_sessions(participant_id, protocol_version, created_at);

    CREATE INDEX IF NOT EXISTS idx_study_sessions_status
      ON study_sessions(protocol_version, status, created_at);

    CREATE INDEX IF NOT EXISTS idx_assignment_blocks_pair
      ON study_assignment_blocks(protocol_version, stimulus_pair_key, created_at);

    CREATE INDEX IF NOT EXISTS idx_artwork_evaluations_trial
      ON artwork_evaluations(trial_id, created_at);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_artwork_evaluations_one_per_trial
      ON artwork_evaluations(trial_id);

    CREATE INDEX IF NOT EXISTS idx_labeled_comparisons_trial
      ON labeled_comparisons(trial_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_manipulation_checks_trial
      ON manipulation_checks(trial_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_questionnaire_responses_session
      ON questionnaire_responses(study_session_id, updated_at);

    CREATE INDEX IF NOT EXISTS idx_questionnaire_responses_trial
      ON questionnaire_responses(trial_id, updated_at);

    CREATE INDEX IF NOT EXISTS idx_questionnaire_responses_participant
      ON questionnaire_responses(participant_id, updated_at);
  `);

  ensureColumn(database, "generation_runs", "music_profile_json", "TEXT NOT NULL DEFAULT 'null'");
  ensureColumn(database, "generation_runs", "conversation_state_json", "TEXT NOT NULL DEFAULT 'null'");
  ensureColumn(database, "generation_runs", "visual_brief_json", "TEXT NOT NULL DEFAULT 'null'");
  ensureColumn(database, "generation_runs", "image_size", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, "generation_runs", "trial_id", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, "generation_runs", "generation_role", "TEXT NOT NULL DEFAULT 'legacy'");
  ensureColumn(database, "generation_runs", "condition", "TEXT NOT NULL DEFAULT 'legacy'");
  ensureColumn(database, "generation_runs", "model_config_json", "TEXT NOT NULL DEFAULT '{}'");
  ensureColumn(database, "generation_runs", "run_log_json", "TEXT NOT NULL DEFAULT '{}'");
  ensureColumn(database, "audio_analyses", "trial_id", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, "conversation_snapshots", "trial_id", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, "visual_brief_versions", "trial_id", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, "interaction_events", "trial_id", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, "study_trials", "protocol_version", "TEXT NOT NULL DEFAULT 'v2-13-blind-comparison'");
  ensureColumn(database, "study_trials", "study_session_id", "TEXT");
  ensureColumn(database, "study_trials", "period", "INTEGER");
  ensureColumn(database, "study_trials", "stimulus_id", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, "study_sessions", "stimulus_x_json", "TEXT NOT NULL DEFAULT 'null'");
  ensureColumn(database, "study_sessions", "stimulus_y_json", "TEXT NOT NULL DEFAULT 'null'");
  ensureColumn(database, "artwork_evaluations", "immersion_score", "INTEGER");
  ensureColumn(database, "artwork_evaluations", "satisfaction_score", "INTEGER");
  database.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_study_trials_session_period
      ON study_trials(study_session_id, period)
      WHERE study_session_id IS NOT NULL AND period IS NOT NULL;
  `);

  return wrapSQLiteDatabase(database);
}

function createSupabaseDatabase(): MelodyDatabase {
  const databaseUrl = process.env.SUPABASE_DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("SUPABASE_DATABASE_URL is required when DATABASE_PROVIDER=supabase");
  }
  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return wrapPostgresDatabase(sql, sql);
}

export function usesSupabaseDatabase(): boolean {
  return process.env.DATABASE_PROVIDER?.trim().toLowerCase() === "supabase";
}

export function getDatabase(): Promise<MelodyDatabase> {
  databasePromise ||= Promise.resolve(
    usesSupabaseDatabase() ? createSupabaseDatabase() : createSQLiteDatabase()
  );
  return databasePromise;
}

export function toJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}
