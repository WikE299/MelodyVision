import type { NextRequest } from "next/server";
import { getGenerationRunResult } from "@/lib/db/generation-runs";
import {
  BaselineNotEligibleError,
  claimBaselineJob,
  failBaselineJob,
  getBaselineJob,
  getStudyTrial,
} from "@/lib/db/study-trials";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const trialId = request.nextUrl.searchParams.get("trialId")?.trim() || "";
  if (!trialId) return Response.json({ error: "trialId is required" }, { status: 400 });
  const [trial, job] = await Promise.all([
    getStudyTrial(trialId),
    getBaselineJob(trialId),
  ]);
  if (!trial) return Response.json({ error: "Trial not found" }, { status: 404 });
  const result = job?.runId ? await getGenerationRunResult(job.runId) : null;
  return Response.json({ trial, job, result });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const trialId = typeof body.trialId === "string" ? body.trialId.trim() : "";
    if (!trialId) return Response.json({ error: "trialId is required" }, { status: 400 });
    const trial = await getStudyTrial(trialId);
    if (!trial) return Response.json({ error: "Trial not found" }, { status: 404 });
    if (body.action === "fail") {
      const error = typeof body.error === "string" ? body.error : "Baseline generation failed";
      await failBaselineJob(trialId, error);
      return Response.json({ failed: true });
    }
    const claimed = await claimBaselineJob(trialId);
    return Response.json({ trial, ...claimed }, { status: claimed.acquired ? 201 : 200 });
  } catch (error) {
    if (error instanceof BaselineNotEligibleError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    console.error("Baseline claim failed:", error);
    return Response.json({ error: "Baseline claim failed" }, { status: 500 });
  }
}
