import { getDatabase } from "./index";

const JSON_COLUMNS = new Set([
  "selected_characters_json",
  "presets_json",
  "music_analysis_json",
  "musician_comments_json",
  "prompt_director_json",
  "timings_json",
  "selected_reasons_json",
]);

function parseJsonColumns(row: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => {
      if (!JSON_COLUMNS.has(key) || typeof value !== "string") {
        return [key, value];
      }

      try {
        return [key.replace(/_json$/, ""), JSON.parse(value)];
      } catch {
        return [key.replace(/_json$/, ""), value];
      }
    })
  );
}

function escapeCsvValue(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export async function exportExperimentJson() {
  const database = await getDatabase();
  const runs = database
    .prepare("SELECT * FROM generation_runs ORDER BY created_at DESC")
    .all()
    .map(parseJsonColumns);
  const feedback = database
    .prepare("SELECT * FROM generation_feedback ORDER BY created_at DESC")
    .all()
    .map(parseJsonColumns);

  return {
    exportedAt: new Date().toISOString(),
    runs,
    feedback,
  };
}

export async function exportExperimentCsv() {
  const data = await exportExperimentJson();
  const rows = data.runs.map((run) => {
    const feedback = data.feedback.filter((item) => item.run_id === run.id);
    return {
      id: run.id,
      session_id: run.session_id,
      created_at: run.created_at,
      selected_characters: run.selected_characters,
      presets: run.presets,
      user_note: run.user_note,
      musician_comments: run.musician_comments,
      final_image_prompt: run.final_image_prompt,
      image_url: run.image_url,
      image_provider: run.image_provider,
      image_model: run.image_model,
      feedback,
    };
  });
  const headers = [
    "id",
    "session_id",
    "created_at",
    "selected_characters",
    "presets",
    "user_note",
    "musician_comments",
    "final_image_prompt",
    "image_url",
    "image_provider",
    "image_model",
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
