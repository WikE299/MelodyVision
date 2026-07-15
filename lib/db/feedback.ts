import { getDatabase, toJson } from "./index";

export interface FeedbackRecord {
  id: string;
  runId: string;
  sessionId: string;
  createdAt: string;
  musicMatchScore: number;
  commentMatchScore: number;
  aestheticScore: number;
  selectedReasons: string[];
  freeText: string;
}

export async function insertFeedback(record: FeedbackRecord) {
  const database = await getDatabase();
  await database
    .prepare(`
      INSERT INTO generation_feedback (
        id,
        run_id,
        session_id,
        created_at,
        music_match_score,
        comment_match_score,
        aesthetic_score,
        selected_reasons_json,
        free_text
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      record.id,
      record.runId,
      record.sessionId,
      record.createdAt,
      record.musicMatchScore,
      record.commentMatchScore,
      record.aestheticScore,
      toJson(record.selectedReasons),
      record.freeText
    );
}
