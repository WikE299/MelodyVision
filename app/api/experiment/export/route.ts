import { exportExperimentCsv, exportExperimentJson } from "@/lib/db/export";
import { authorizeExperimentExport } from "@/lib/export-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authorization = authorizeExperimentExport(request.headers);
  if (!authorization.ok) {
    return Response.json(
      { error: authorization.error },
      { status: authorization.status }
    );
  }
  const url = new URL(request.url);
  const format = url.searchParams.get("format");

  if (format === "csv") {
    const csv = await exportExperimentCsv();
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=\"melodyvision-experiment.csv\"",
      },
    });
  }

  return Response.json(await exportExperimentJson());
}
