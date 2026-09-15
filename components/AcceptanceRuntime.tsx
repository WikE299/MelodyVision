"use client";

import type { ReactNode } from "react";
import { installAcceptanceRuntime, isAcceptanceMode } from "@/lib/acceptance-runtime";

export default function AcceptanceRuntime({ children }: { children: ReactNode }) {
  if (typeof window !== "undefined" && (
    window.location.pathname === "/acceptance" ||
    window.location.search.includes("acceptance=1") ||
    isAcceptanceMode()
  )) {
    installAcceptanceRuntime();
  }
  return children;
}
