import { randomUUID } from "node:crypto";
import { insertFeedback } from "@/lib/db/feedback";

export const runtime = "nodejs";

function toScore(value: unknown): number | null {
  const score = Number(value);
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    return null;
  }
  return score;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const runId = typeof body.runId === "string" ? body.runId.trim() : "";
    const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
    const musicMatchScore = toScore(body.musicMatchScore);
    const commentMatchScore = toScore(body.commentMatchScore);
    const aestheticScore = toScore(body.aestheticScore);
    const selectedReasons = Array.isArray(body.selectedReasons)
      ? body.selectedReasons.filter((reason: unknown) => typeof reason === "string")
      : [];
    const freeText = typeof body.freeText === "string" ? body.freeText.trim() : "";

    if (!runId || !sessionId) {
      return Response.json({ error: "runId and sessionId are required" }, { status: 400 });
    }
    if (musicMatchScore === null || commentMatchScore === null || aestheticScore === null) {
      return Response.json({ error: "Scores must be integers from 1 to 5" }, { status: 400 });
    }

    const feedbackId = randomUUID();
    await insertFeedback({
      id: feedbackId,
      runId,
      sessionId,
      createdAt: new Date().toISOString(),
      musicMatchScore,
      commentMatchScore,
      aestheticScore,
      selectedReasons,
      freeText,
    });

    return Response.json({ feedbackId });
  } catch (error) {
    console.error("Feedback save failed:", error);
    return Response.json(
      { error: "Feedback save failed", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
