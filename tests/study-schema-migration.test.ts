import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

test("legacy study databases migrate to the within-subject crossover schema", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "melodyvision-study-migration-"));
  const databasePath = path.join(directory, "melodyvision.sqlite");
  const legacy = new DatabaseSync(databasePath);
  legacy.exec(`
    CREATE TABLE study_trials (
      id TEXT PRIMARY KEY,
      participant_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      condition TEXT NOT NULL,
      assignment_method TEXT NOT NULL,
      music_profile_id TEXT NOT NULL,
      co_created_run_id TEXT,
      baseline_run_id TEXT,
      comparison_order TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE artwork_evaluations (
      id TEXT PRIMARY KEY,
      trial_id TEXT NOT NULL,
      run_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      music_match_score INTEGER NOT NULL,
      imagination_match_score INTEGER NOT NULL,
      agency_score INTEGER NOT NULL,
      ownership_score INTEGER NOT NULL
    );

    INSERT INTO study_trials (
      id, participant_id, session_id, condition, assignment_method,
      music_profile_id, comparison_order, status, created_at, updated_at
    ) VALUES (
      'legacy-trial', 'legacy-participant', 'legacy-session', 'multi_agent',
      'demo_choice', 'legacy-profile', 'baseline_left', 'completed',
      '2026-07-15T00:00:00.000Z', '2026-07-15T00:00:00.000Z'
    );
  `);
  (legacy as unknown as { close(): void }).close();

  process.env.MELODYVISION_DATA_DIR = directory;
  try {
    const { getDatabase } = await import("../lib/db/index.ts");
    const database = await getDatabase();
    const trialColumns = await database.prepare("PRAGMA table_info(study_trials)").all();
    const evaluationColumns = await database.prepare("PRAGMA table_info(artwork_evaluations)").all();
    const migratedTrial = (await database.prepare(
      "SELECT protocol_version FROM study_trials WHERE id = ?"
    ).all("legacy-trial"))[0];
    const newTables = await database.prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name IN (
        'labeled_comparisons',
        'manipulation_checks',
        'questionnaire_responses',
        'session_comparisons',
        'study_assignment_blocks',
        'study_sessions'
      )
      ORDER BY name
    `).all();

    assert.equal(trialColumns.some((column) => column.name === "protocol_version"), true);
    assert.equal(trialColumns.some((column) => column.name === "study_session_id"), true);
    assert.equal(trialColumns.some((column) => column.name === "period"), true);
    assert.equal(trialColumns.some((column) => column.name === "stimulus_id"), true);
    assert.equal(evaluationColumns.some((column) => column.name === "immersion_score"), true);
    assert.equal(evaluationColumns.some((column) => column.name === "satisfaction_score"), true);
    assert.equal(migratedTrial.protocol_version, "v2-13-blind-comparison");
    assert.deepEqual(newTables.map((table) => table.name), [
      "labeled_comparisons",
      "manipulation_checks",
      "questionnaire_responses",
      "session_comparisons",
      "study_assignment_blocks",
      "study_sessions",
    ]);
  } finally {
    delete process.env.MELODYVISION_DATA_DIR;
    await rm(directory, { recursive: true, force: true });
  }
});
