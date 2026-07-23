import { exportExperimentJson } from "@/lib/db/export";
import { isLocalResearchRequest } from "@/lib/research-access";
import { buildResearchDashboardDataset } from "@/lib/research-dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isLocalResearchRequest(request.headers)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const data = buildResearchDashboardDataset(
    await exportExperimentJson(),
    "database"
  );
  return Response.json(data, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
