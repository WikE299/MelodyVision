import type { NextRequest } from "next/server";
import { insertInteractionEvent } from "@/lib/db/research-data";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
    const eventType = typeof body.eventType === "string" ? body.eventType.trim() : "";
    const page = typeof body.page === "string" ? body.page.trim() : "";
    if (!sessionId || !eventType || !page) {
      return Response.json({ error: "Invalid interaction event" }, { status: 400 });
    }
    await insertInteractionEvent({
      trialId: body.payload && typeof body.payload === "object" && "trialId" in body.payload
        ? String((body.payload as { trialId?: unknown }).trialId || "")
        : "",
      sessionId,
      eventType: eventType.slice(0, 100),
      page: page.slice(0, 100),
      payload: body.payload ?? {},
    });
    return Response.json({ saved: true });
  } catch (error) {
    return Response.json(
      { error: "Interaction event failed", detail: String(error) },
      { status: 500 }
    );
  }
}
