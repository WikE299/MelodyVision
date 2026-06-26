import { randomUUID } from "node:crypto";

export const runtime = "nodejs";

export async function POST() {
  return Response.json({
    sessionId: randomUUID(),
    createdAt: new Date().toISOString(),
  });
}
