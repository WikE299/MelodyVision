import { exportExperimentCsv, exportExperimentJson } from "@/lib/db/export";

export const runtime = "nodejs";

export async function GET(request: Request) {
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
