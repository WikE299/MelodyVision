import type { NextRequest } from "next/server";
import { insertAudioAnalysis } from "@/lib/db/research-data";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
    const mode = typeof body.mode === "string" ? body.mode.trim() : "";
    const sourceKind = typeof body.sourceKind === "string" ? body.sourceKind.trim() : "";
    const fileName = typeof body.fileName === "string" ? body.fileName.trim().slice(0, 300) : "";
    const fileSize = typeof body.fileSize === "number" ? body.fileSize : Number.NaN;

    if (!sessionId || !mode || !sourceKind || !fileName || !Number.isFinite(fileSize) || fileSize < 0) {
      return Response.json({ error: "Invalid audio analysis record" }, { status: 400 });
    }

    await insertAudioAnalysis({
      sessionId,
      mode,
      sourceKind,
      fileName,
      fileSize,
      musicProfile: body.musicProfile ?? null,
      compatibilityAnalysis: body.compatibilityAnalysis ?? null,
    });
    return Response.json({ saved: true });
  } catch (error) {
    return Response.json(
      { error: "Audio analysis record failed", detail: String(error) },
      { status: 500 }
    );
  }
}
