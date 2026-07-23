import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { exportExperimentJson } from "@/lib/db/export";
import { isLocalResearchRequest } from "@/lib/research-access";
import { buildResearchDashboardDataset } from "@/lib/research-dashboard";
import ResearchDashboardClient from "./ResearchDashboardClient";

export const dynamic = "force-dynamic";

export default async function ResearchPage() {
  if (!isLocalResearchRequest(await headers())) notFound();

  const initialData = buildResearchDashboardDataset(
    await exportExperimentJson(),
    "database"
  );

  const remoteSyncEnabled = Boolean(
    (process.env.RESEARCH_SUPABASE_URL?.trim()
      && process.env.RESEARCH_SUPABASE_SERVICE_ROLE_KEY?.trim())
    || (process.env.RESEARCH_REMOTE_EXPORT_URL?.trim()
      && (process.env.RESEARCH_REMOTE_EXPORT_TOKEN?.trim()
        || process.env.EXPERIMENT_EXPORT_TOKEN?.trim()))
  );

  return (
    <ResearchDashboardClient
      initialData={initialData}
      remoteSyncEnabled={remoteSyncEnabled}
    />
  );
}
