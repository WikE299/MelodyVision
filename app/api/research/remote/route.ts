import { buildResearchDashboardDataset } from "@/lib/research-dashboard";
import { isLocalResearchRequest } from "@/lib/research-access";
import {
  fetchRemoteResearchExport,
  fetchSupabaseResearchExport,
  getRemoteResearchConfig,
  getRemoteSupabaseResearchConfig,
  readRemoteResearchCache,
  writeRemoteResearchCache,
} from "@/lib/research-remote";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isLocalResearchRequest(request.headers)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const supabaseConfig = getRemoteSupabaseResearchConfig();
  const exportConfig = getRemoteResearchConfig();
  if (!supabaseConfig && !exportConfig) {
    return Response.json(
      { error: "Online research sync is not configured" },
      { status: 503 }
    );
  }

  try {
    const snapshot = supabaseConfig
      ? await fetchSupabaseResearchExport(supabaseConfig)
      : await fetchRemoteResearchExport(exportConfig!);
    await writeRemoteResearchCache(snapshot);
    return Response.json({
      dataset: buildResearchDashboardDataset(snapshot, "remote"),
      transport: "live",
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const cached = await readRemoteResearchCache();
    if (cached) {
      return Response.json({
        dataset: buildResearchDashboardDataset(cached, "remote"),
        transport: "cache",
        warning: error instanceof Error ? error.message : "Online sync failed",
      }, {
        headers: { "Cache-Control": "no-store" },
      });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "Online sync failed" },
      { status: 502 }
    );
  }
}
