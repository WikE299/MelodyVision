import { getDatabase, toJson } from "./index";

export interface GenerationRunRecord {
  id: string;
  sessionId: string;
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
  logPath: string;
}

export async function insertGenerationRun(record: GenerationRunRecord) {
  const database = await getDatabase();
  database
    .prepare(`
      INSERT INTO generation_runs (
        id,
        session_id,
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
        log_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      record.id,
      record.sessionId,
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
      record.logPath
    );
}
