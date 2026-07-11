import { randomUUID } from "node:crypto";
import { upsertExperimentSession } from "@/lib/db/research-data";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const requestedId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  const sessionId = requestedId.slice(0, 100) || randomUUID();
  const createdAt = new Date().toISOString();
  await upsertExperimentSession({ id: sessionId, createdAt });
  return Response.json({
    sessionId,
    createdAt,
  });
}
