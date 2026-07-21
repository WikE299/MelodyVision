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

  return <ResearchDashboardClient initialData={initialData} />;
}
