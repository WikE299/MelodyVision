import { getDatabase } from "./index.ts";

const JSON_COLUMNS = new Set([
  "metadata_json",
  "selected_characters_json",
  "presets_json",
  "music_analysis_json",
  "music_profile_json",
  "compatibility_analysis_json",
  "conversation_state_json",
  "visual_brief_json",
  "state_json",
  "brief_json",
  "meta_json",
  "payload_json",
  "musician_comments_json",
  "prompt_director_json",
  "timings_json",
  "model_config_json",
  "selected_reasons_json",
]);

function parseJsonColumns(row: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => {
      if (!JSON_COLUMNS.has(key)) return [key, value];
      if (typeof value !== "string") return [key.replace(/_json$/, ""), value];
      try {
        return [key.replace(/_json$/, ""), JSON.parse(value)];
      } catch {
        return [key.replace(/_json$/, ""), value];
      }
    })
  );
}

function escapeCsvValue(value: unknown): string {
  let text = value === null || value === undefined
    ? ""
    : typeof value === "string" ? value : JSON.stringify(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

async function readRows(
  database: Awaited<ReturnType<typeof getDatabase>>,
  table: string,
  orderColumn = "created_at"
) {
  return (await database
    .prepare(`SELECT * FROM ${table} ORDER BY ${orderColumn} DESC`)
    .all())
    .map(parseJsonColumns);
}

export async function exportExperimentJson() {
  const database = await getDatabase();
  return {
    schemaVersion: 3,
    exportedAt: new Date().toISOString(),
    sessions: await readRows(database, "experiment_sessions"),
    audioAnalyses: await readRows(database, "audio_analyses"),
    conversationSnapshots: await readRows(database, "conversation_snapshots"),
    visualBriefVersions: await readRows(database, "visual_brief_versions"),
    interactionEvents: await readRows(database, "interaction_events"),
    runs: await readRows(database, "generation_runs"),
    feedback: await readRows(database, "generation_feedback"),
    trials: await readRows(database, "study_trials"),
    baselineJobs: await readRows(database, "baseline_jobs", "updated_at"),
    artworkEvaluations: await readRows(database, "artwork_evaluations"),
    pairwiseComparisons: await readRows(database, "pairwise_comparisons"),
  };
}

export async function exportExperimentCsv() {
  const data = await exportExperimentJson();
  const rows = data.trials.map((trial) => {
    const sessionId = trial.session_id;
    const trialId = trial.id;
    return {
      trial_id: trialId,
      participant_id: trial.participant_id,
      session_id: sessionId,
      condition: trial.condition,
      assignment_method: trial.assignment_method,
      comparison_order: trial.comparison_order,
      status: trial.status,
      created_at: trial.created_at,
      audio_analyses: data.audioAnalyses.filter((item) => item.trial_id === trialId),
      conversation_snapshots: data.conversationSnapshots.filter((item) =>
        item.trial_id === trialId || (!item.trial_id && item.session_id === sessionId)
      ),
      visual_brief_versions: data.visualBriefVersions.filter((item) =>
        item.trial_id === trialId || (!item.trial_id && item.session_id === sessionId)
      ),
      interaction_events: data.interactionEvents.filter((item) =>
        item.trial_id === trialId || (!item.trial_id && item.session_id === sessionId)
      ),
      generation_runs: data.runs.filter((item) => item.trial_id === trialId),
      baseline_job: data.baselineJobs.find((item) => item.trial_id === trialId) || null,
      artwork_evaluation: data.artworkEvaluations.find((item) => item.trial_id === trialId) || null,
      pairwise_comparison: data.pairwiseComparisons.find((item) => item.trial_id === trialId) || null,
    };
  });
  const headers = [
    "trial_id",
    "participant_id",
    "session_id",
    "condition",
    "assignment_method",
    "comparison_order",
    "status",
    "created_at",
    "audio_analyses",
    "conversation_snapshots",
    "visual_brief_versions",
    "interaction_events",
    "generation_runs",
    "baseline_job",
    "artwork_evaluation",
    "pairwise_comparison",
  ];
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => escapeCsvValue(row[header as keyof typeof row])).join(",")
    ),
  ];
  return `${lines.join("\n")}\n`;
}
