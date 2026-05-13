"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AudioUploader from "@/components/AudioUploader";
import PresetAudios from "@/components/PresetAudios";

export default function Home() {
  const router = useRouter();
  const [analyzing, setAnalyzing] = useState(false);

  const handleFileSelect = async (file: File) => {
    setAnalyzing(true);

    // Store file info in sessionStorage for the flow
    sessionStorage.setItem("audioFileName", file.name);
    sessionStorage.setItem("audioFileSize", String(file.size));

    // Create object URL for later use
    const url = URL.createObjectURL(file);
    sessionStorage.setItem("audioObjectUrl", url);

    // TODO: Upload and analyze audio
    // For now, mock the analysis
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Mock analysis result
    const mockAnalysis = {
      key: "D 大调",
      tempo: "中速 (Andante)",
      mood: "宁静、优美",
      instruments: ["古筝", "二胡", "竹笛"],
      energy: "舒缓",
      genre: "中国传统民乐",
      description: "旋律流畅优美，具有典型的江南水乡韵味",
    };
    sessionStorage.setItem("musicAnalysis", JSON.stringify(mockAnalysis));

    router.push("/select");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-12">
      <div className="w-full max-w-md flex flex-col items-center gap-8">
        {/* Title */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            MelodyVision
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            音乐画师 — 当音乐作画
          </p>
          <p className="mt-1 text-xs text-gray-400">
            上传一首曲子，让古代音乐家为你点评，再生成一幅画
          </p>
        </div>

        {/* Upload area */}
        <AudioUploader onFileSelect={handleFileSelect} disabled={analyzing} />

        {/* Preset audios */}
        {!analyzing && <PresetAudios onSelect={handleFileSelect} />}

        {/* Loading state */}
        {analyzing && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>正在分析音乐...</span>
          </div>
        )}
      </div>
    </div>
  );
}
