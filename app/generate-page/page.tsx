"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import PresetSelector, { Presets } from "@/components/PresetSelector";

export default function GeneratePage() {
  const router = useRouter();
  const [presets, setPresets] = useState<Presets>({
    style: "水墨",
    mood: "宁静",
    tone: "淡雅",
  });
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const comments = JSON.parse(sessionStorage.getItem("comments") || "{}");
    if (Object.keys(comments).length === 0) {
      router.push("/listen");
    }
  }, [router]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);

    try {
      const comments = JSON.parse(sessionStorage.getItem("comments") || "{}");
      const userNote = sessionStorage.getItem("userNote") || "";
      const musicAnalysis = JSON.parse(
        sessionStorage.getItem("musicAnalysis") || "{}"
      );
      const selectedCharacters = JSON.parse(
        sessionStorage.getItem("selectedCharacters") || "[]"
      ) as string[];
      const commentList = selectedCharacters
        .filter((characterId) => comments[characterId])
        .map((characterId) => ({
          characterId,
          text: comments[characterId],
        }));

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comments: commentList,
          presets,
          userNote,
          musicAnalysis,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.imageUrl) {
        throw new Error(data.detail || data.error || "生成失败");
      }

      sessionStorage.setItem("imagePresets", JSON.stringify(presets));
      sessionStorage.setItem("generatedImageUrl", data.imageUrl);
      sessionStorage.setItem("generatedRemoteImageUrl", data.remoteImageUrl || "");
      sessionStorage.setItem("generatedImagePrompt", data.prompt || "");
      sessionStorage.setItem("imageGenerationMeta", JSON.stringify({
        runId: data.runId,
        provider: data.provider,
        model: data.model,
        requestId: data.requestId,
        promptSource: data.promptSource,
        promptDirector: data.promptDirector,
        logPath: data.logPath,
        timings: data.timings,
        usage: data.usage,
      }));

      router.push("/result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败，请稍后重试");
      setGenerating(false);
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-8">
      <div className="w-full max-w-md flex flex-col items-center gap-8">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">选择画面风格</h2>
          <p className="text-sm text-gray-500 mt-1">
            AI 将综合音乐家评论生成画面
          </p>
        </div>

        {/* Preset selector */}
        <PresetSelector value={presets} onChange={setPresets} disabled={generating} />

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={generating}
          className={`
            w-full py-3 rounded-xl text-sm font-medium transition-all
            ${
              generating
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-gray-900 text-white hover:bg-gray-800"
            }
          `}
        >
          {generating ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              生成中...
            </span>
          ) : (
            "生成画作"
          )}
        </button>

        {error && (
          <p className="text-sm text-red-500 text-center">{error}</p>
        )}
      </div>
    </div>
  );
}
