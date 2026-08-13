import { getDatabase } from "./index.ts";

const JSON_COLUMNS = new Set([
  "metadata_json",
  "sequences_json",
  "selected_musician_ids_json",
  "stimulus_x_json",
  "stimulus_y_json",
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
  "answers_json",
  "metrics_json",
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
    schemaVersion: 6,
    exportedAt: new Date().toISOString(),
    sessions: await readRows(database, "experiment_sessions"),
    studySessions: await readRows(database, "study_sessions"),
    studyAssignmentBlocks: await readRows(database, "study_assignment_blocks", "updated_at"),
    sessionComparisons: await readRows(database, "session_comparisons"),
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
    labeledComparisons: await readRows(database, "labeled_comparisons"),
    manipulationChecks: await readRows(database, "manipulation_checks"),
    questionnaireResponses: await readRows(database, "questionnaire_responses", "updated_at"),
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
      study_session_id: trial.study_session_id,
      period: trial.period,
      stimulus_id: trial.stimulus_id,
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
      labeled_comparison: data.labeledComparisons.find((item) => item.trial_id === trialId) || null,
      manipulation_check: data.manipulationChecks.find((item) => item.trial_id === trialId) || null,
      questionnaire_responses: data.questionnaireResponses.filter((item) => (
        item.trial_id === trialId
      )),
    };
  });
  const headers = [
    "trial_id",
    "participant_id",
    "session_id",
    "study_session_id",
    "period",
    "stimulus_id",
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
    "labeled_comparison",
    "manipulation_check",
    "questionnaire_responses",
  ];
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => escapeCsvValue(row[header as keyof typeof row])).join(",")
    ),
  ];
  return `${lines.join("\n")}\n`;
}
