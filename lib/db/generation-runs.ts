import { getDatabase, toJson } from "./index.ts";
import type { GenerationRole, InteractiveCondition } from "../contracts/study-trial.ts";

export interface GenerationRunRecord {
  id: string;
  sessionId: string;
  trialId?: string;
  generationRole?: GenerationRole;
  condition?: InteractiveCondition;
  createdAt: string;
  selectedCharacters: string[];
  presets: unknown;
  userNote: string;
  musicAnalysis: unknown;
  musicProfile: unknown;
  conversationState: unknown;
  visualBrief: unknown;
  musicianComments: unknown;
  promptDirector: unknown;
  finalImagePrompt: string;
  negativePrompt: string;
  imageUrl: string;
  remoteImageUrl: string;
  imageProvider: string;
  imageModel: string;
  imageSize: string;
  imageRequestId: string;
  timings: unknown;
  modelConfig?: unknown;
  runLog?: unknown;
  logPath: string;
}

export async function insertGenerationRun(record: GenerationRunRecord) {
  const database = await getDatabase();
  await database
    .prepare(`
      INSERT INTO generation_runs (
        id,
        session_id,
        trial_id,
        generation_role,
        condition,
        created_at,
        selected_characters_json,
        presets_json,
        user_note,
        music_analysis_json,
        music_profile_json,
        conversation_state_json,
        visual_brief_json,
        musician_comments_json,
        prompt_director_json,
        final_image_prompt,
        negative_prompt,
        image_url,
        remote_image_url,
        image_provider,
        image_model,
        image_size,
        image_request_id,
        timings_json,
        model_config_json,
        run_log_json,
        log_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      record.id,
      record.sessionId,
      record.trialId || "",
      record.generationRole || "co_created",
      record.condition || "multi_agent",
      record.createdAt,
      toJson(record.selectedCharacters),
      toJson(record.presets),
      record.userNote,
      toJson(record.musicAnalysis),
      toJson(record.musicProfile),
      toJson(record.conversationState),
      toJson(record.visualBrief),
      toJson(record.musicianComments),
      toJson(record.promptDirector),
      record.finalImagePrompt,
      record.negativePrompt,
      record.imageUrl,
      record.remoteImageUrl,
      record.imageProvider,
      record.imageModel,
      record.imageSize,
      record.imageRequestId,
      toJson(record.timings),
      toJson(record.modelConfig || {}),
      toJson(record.runLog || {}),
      record.logPath
    );
}

export async function getGenerationRunResult(id: string) {
  const database = await getDatabase();
  const row = (await database.prepare(`
    SELECT id, trial_id, generation_role, condition, image_url, remote_image_url,
           final_image_prompt, negative_prompt, image_model, image_size, timings_json
    FROM generation_runs WHERE id = ?
  `).all(id))[0];
  if (!row) return null;
  return {
    runId: String(row.id),
    trialId: String(row.trial_id || ""),
    generationRole: String(row.generation_role || "legacy"),
    condition: String(row.condition || "legacy"),
    imageUrl: String(row.image_url || ""),
    remoteImageUrl: String(row.remote_image_url || ""),
    prompt: String(row.final_image_prompt || ""),
    negativePrompt: String(row.negative_prompt || ""),
    imageModel: String(row.image_model || ""),
    imageSize: String(row.image_size || ""),
    timings: (() => {
      try {
        return JSON.parse(String(row.timings_json || "{}"));
      } catch {
        return {};
      }
    })(),
  };
}
