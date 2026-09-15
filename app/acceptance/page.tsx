import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { isAcceptanceFlowRequest } from "@/lib/acceptance-flow-access";
import AcceptanceBootstrap from "./AcceptanceBootstrap";

export const dynamic = "force-dynamic";

export default async function AcceptanceFlowPage() {
  if (!isAcceptanceFlowRequest(await headers())) notFound();
  return <AcceptanceBootstrap />;
}
