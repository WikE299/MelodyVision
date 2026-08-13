import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const CACHE_PATH = path.join(process.cwd(), "data", "research-cache", "remote-latest.json");
const MAX_EXPORT_BYTES = 50 * 1024 * 1024;

export interface RemoteResearchConfig {
  exportUrl: string;
  token: string;
}

export interface RemoteSupabaseResearchConfig {
  baseUrl: string;
  serviceRoleKey: string;
}

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
  "run_log_json",
  "selected_reasons_json",
  "answers_json",
  "metrics_json",
]);

const SUPABASE_TABLES = {
  sessions: "experiment_sessions",
  studySessions: "study_sessions",
  studyAssignmentBlocks: "study_assignment_blocks",
  sessionComparisons: "session_comparisons",
  audioAnalyses: "audio_analyses",
  conversationSnapshots: "conversation_snapshots",
  visualBriefVersions: "visual_brief_versions",
  interactionEvents: "interaction_events",
  runs: "generation_runs",
  feedback: "generation_feedback",
  trials: "study_trials",
  baselineJobs: "baseline_jobs",
  artworkEvaluations: "artwork_evaluations",
  pairwiseComparisons: "pairwise_comparisons",
  labeledComparisons: "labeled_comparisons",
  manipulationChecks: "manipulation_checks",
  questionnaireResponses: "questionnaire_responses",
} as const;

const OPTIONAL_SUPABASE_TABLES = new Set([
  "study_sessions",
  "study_assignment_blocks",
  "session_comparisons",
  "questionnaire_responses",
]);

function normalizeSupabaseRow(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => {
    if (!JSON_COLUMNS.has(key)) return [key, value];
    if (typeof value !== "string") return [key.replace(/_json$/, ""), value];
    try {
      return [key.replace(/_json$/, ""), JSON.parse(value) as unknown];
    } catch {
      return [key.replace(/_json$/, ""), value];
    }
  }));
}

export function getRemoteResearchConfig(
  environment: NodeJS.ProcessEnv = process.env
): RemoteResearchConfig | null {
  const exportUrl = environment.RESEARCH_REMOTE_EXPORT_URL?.trim() || "";
  const token = environment.RESEARCH_REMOTE_EXPORT_TOKEN?.trim()
    || environment.EXPERIMENT_EXPORT_TOKEN?.trim()
    || "";
  if (!exportUrl || !token) return null;

  const parsed = new URL(exportUrl);
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
    throw new Error("RESEARCH_REMOTE_EXPORT_URL must use HTTPS");
  }
  return { exportUrl: parsed.toString(), token };
}

export function getRemoteSupabaseResearchConfig(
  environment: NodeJS.ProcessEnv = process.env
): RemoteSupabaseResearchConfig | null {
  const baseUrl = environment.RESEARCH_SUPABASE_URL?.trim().replace(/\/$/, "") || "";
  const serviceRoleKey = environment.RESEARCH_SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  if (!baseUrl || !serviceRoleKey) return null;
  const parsed = new URL(baseUrl);
  if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".supabase.co")) {
    throw new Error("RESEARCH_SUPABASE_URL must be a Supabase HTTPS URL");
  }
  return { baseUrl: parsed.origin, serviceRoleKey };
}

export async function fetchRemoteResearchExport(
  config: RemoteResearchConfig,
  fetcher: typeof fetch = fetch
): Promise<unknown> {
  const response = await fetcher(config.exportUrl, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${config.token}`,
    },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Online research export failed (${response.status})`);
  }
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_EXPORT_BYTES) {
    throw new Error("Online research export is too large");
  }
  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > MAX_EXPORT_BYTES) {
    throw new Error("Online research export is too large");
  }
  return JSON.parse(text) as unknown;
}

async function fetchSupabaseTable(
  config: RemoteSupabaseResearchConfig,
  table: string,
  fetcher: typeof fetch,
  optional = false
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  const pageSize = 1000;
  for (let start = 0; ; start += pageSize) {
    let response: Response | null = null;
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        response = await fetcher(`${config.baseUrl}/rest/v1/${table}?select=*`, {
          headers: {
            Accept: "application/json",
            apikey: config.serviceRoleKey,
            Authorization: `Bearer ${config.serviceRoleKey}`,
            Range: `${start}-${start + pageSize - 1}`,
          },
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(30_000),
        });
        if (response.ok || response.status < 500) break;
        lastError = new Error(`Supabase table ${table} failed (${response.status})`);
      } catch (error) {
        lastError = error;
      }
    }
    if (!response) throw lastError instanceof Error ? lastError : new Error(`Supabase table ${table} failed`);
    if (!response.ok) {
      if (optional && response.status === 404) return [];
      throw new Error(`Supabase table ${table} failed (${response.status})`);
    }
    const page = await response.json() as Record<string, unknown>[];
    rows.push(...page.map(normalizeSupabaseRow));
    if (page.length < pageSize) return rows;
  }
}

export async function fetchSupabaseResearchExport(
  config: RemoteSupabaseResearchConfig,
  fetcher: typeof fetch = fetch
): Promise<unknown> {
  const entries = await Promise.all(Object.entries(SUPABASE_TABLES).map(
    async ([key, table]) => [
      key,
      await fetchSupabaseTable(config, table, fetcher, OPTIONAL_SUPABASE_TABLES.has(table)),
    ] as const
  ));
  return {
    schemaVersion: 6,
    exportedAt: new Date().toISOString(),
    ...Object.fromEntries(entries),
  };
}

export async function writeRemoteResearchCache(value: unknown): Promise<void> {
  await mkdir(path.dirname(CACHE_PATH), { recursive: true });
  await writeFile(CACHE_PATH, JSON.stringify(value), "utf8");
}

export async function readRemoteResearchCache(): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(CACHE_PATH, "utf8")) as unknown;
  } catch {
    return null;
  }
}
