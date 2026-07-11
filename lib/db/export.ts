import { getDatabase } from "./index";

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
  "selected_reasons_json",
]);

function parseJsonColumns(row: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => {
      if (!JSON_COLUMNS.has(key) || typeof value !== "string") return [key, value];
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

function readRows(database: Awaited<ReturnType<typeof getDatabase>>, table: string) {
  return database
    .prepare(`SELECT * FROM ${table} ORDER BY created_at DESC`)
    .all()
    .map(parseJsonColumns);
}

export async function exportExperimentJson() {
  const database = await getDatabase();
  return {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    sessions: readRows(database, "experiment_sessions"),
    audioAnalyses: readRows(database, "audio_analyses"),
    conversationSnapshots: readRows(database, "conversation_snapshots"),
    visualBriefVersions: readRows(database, "visual_brief_versions"),
    interactionEvents: readRows(database, "interaction_events"),
    runs: readRows(database, "generation_runs"),
    feedback: readRows(database, "generation_feedback"),
  };
}

export async function exportExperimentCsv() {
  const data = await exportExperimentJson();
  const rows = data.runs.map((run) => {
    const sessionId = run.session_id;
    return {
      id: run.id,
      session_id: sessionId,
      created_at: run.created_at,
      selected_characters: run.selected_characters,
      user_note: run.user_note,
      music_profile: run.music_profile,
      conversation_state: run.conversation_state,
      visual_brief: run.visual_brief,
      musician_comments: run.musician_comments,
      final_image_prompt: run.final_image_prompt,
      negative_prompt: run.negative_prompt,
      image_url: run.image_url,
      image_provider: run.image_provider,
      image_model: run.image_model,
      audio_analyses: data.audioAnalyses.filter((item) => item.session_id === sessionId),
      conversation_snapshots: data.conversationSnapshots.filter((item) => item.session_id === sessionId),
      visual_brief_versions: data.visualBriefVersions.filter((item) => item.session_id === sessionId),
      interaction_events: data.interactionEvents.filter((item) => item.session_id === sessionId),
      feedback: data.feedback.filter((item) => item.run_id === run.id),
    };
  });
  const headers = [
    "id",
    "session_id",
    "created_at",
    "selected_characters",
    "user_note",
    "music_profile",
    "conversation_state",
    "visual_brief",
    "musician_comments",
    "final_image_prompt",
    "negative_prompt",
    "image_url",
    "image_provider",
    "image_model",
    "audio_analyses",
    "conversation_snapshots",
    "visual_brief_versions",
    "interaction_events",
    "feedback",
  ];
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => escapeCsvValue(row[header as keyof typeof row])).join(",")
    ),
  ];
  return `${lines.join("\n")}\n`;
}
