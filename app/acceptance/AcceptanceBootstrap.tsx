"use client";

import { useEffect } from "react";
import { resetAcceptanceRuntime } from "@/lib/acceptance-runtime";

export default function AcceptanceBootstrap() {
  useEffect(() => {
    resetAcceptanceRuntime();
    window.location.replace("/?study=1&acceptance=1");
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#17151c] px-6 text-[#ffe4bd]">
      <div className="border border-[#9a704e]/50 bg-[#211c25] px-8 py-7 text-center">
        <p className="font-serif text-2xl font-semibold">正在进入本地验收流程</p>
        <p className="mt-2 text-sm text-[#bca38d]">使用正式页面与预置数据，不调用模型或数据库。</p>
      </div>
    </main>
  );
}
