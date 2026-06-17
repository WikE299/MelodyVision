"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { chineseCharacters, westernCharacters } from "@/lib/characters";
import CharacterCard from "@/components/CharacterCard";

const DEFAULT_COMBO = ["boya", "beethoven", "abing", "armstrong"];
const COMMENT_FAILED_TEXT = "（评论生成失败，请重试）";

export default function SelectPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const toggleCharacter = (id: string) => {
    if (generating) return;
    setSelected((prev) => {
      if (prev.includes(id)) {
        return prev.filter((c) => c !== id);
      }
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  };

  const applyDefaultCombo = () => {
    if (generating) return;
    setSelected(DEFAULT_COMBO);
  };

  const generateComment = async (characterId: string, musicAnalysis: unknown) => {
    const res = await fetch("/api/comment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterId,
        musicAnalysis,
      }),
    });

    if (!res.ok) throw new Error("Comment API failed");
    const data = await res.json();
    return data.comment as string;
  };

  const handleContinue = async () => {
    if (selected.length === 0 || generating) return;

    setGenerating(true);
    setError("");
    sessionStorage.setItem("selectedCharacters", JSON.stringify(selected));
    sessionStorage.removeItem("comments");

    try {
      const musicAnalysis = JSON.parse(
        sessionStorage.getItem("musicAnalysis") || "{}"
      );
      const results = await Promise.allSettled(
        selected.map(async (characterId) => ({
          characterId,
          comment: await generateComment(characterId, musicAnalysis),
        }))
      );
      const successCount = results.filter((result) => result.status === "fulfilled").length;

      if (successCount === 0) {
        throw new Error("All comment requests failed");
      }

      const comments = Object.fromEntries(
        results.map((result, index) => {
          const characterId = selected[index];
          if (result.status === "fulfilled") {
            return [result.value.characterId, result.value.comment];
          }
          return [characterId, COMMENT_FAILED_TEXT];
        })
      );

      sessionStorage.setItem("comments", JSON.stringify(comments));
      router.push("/listen");
    } catch {
      setError("评论生成失败，请稍后重试");
      setGenerating(false);
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-8">
      <div className="w-full max-w-lg flex flex-col items-center gap-6">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">选择音乐家</h2>
          <p className="text-sm text-gray-500 mt-1">选择 1-4 位音乐家陪你一起听</p>
        </div>

        {/* Quick combo */}
        <button
          onClick={applyDefaultCombo}
          disabled={generating}
          className="px-4 py-1.5 rounded-full text-xs border border-blue-200 text-blue-600 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          推荐组合：伯牙 + 贝多芬 + 阿炳 + 阿姆斯特朗
        </button>

        {/* Chinese group */}
        <div className="w-full">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">中</span>
            <span className="text-xs text-gray-400">中国音乐家</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {chineseCharacters.map((char) => (
              <CharacterCard
                key={char.id}
                character={char}
                selected={selected.includes(char.id)}
                commented={false}
                onClick={() => toggleCharacter(char.id)}
                disabled={generating}
              />
            ))}
          </div>
        </div>

        {/* Western group */}
        <div className="w-full">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">西</span>
            <span className="text-xs text-gray-400">西方音乐家</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {westernCharacters.map((char) => (
              <CharacterCard
                key={char.id}
                character={char}
                selected={selected.includes(char.id)}
                commented={false}
                onClick={() => toggleCharacter(char.id)}
                disabled={generating}
              />
            ))}
          </div>
        </div>

        {/* Selection count */}
        <p className="text-xs text-gray-400">
          已选择 {selected.length} / 4 位
        </p>

        {/* Continue button */}
        <button
          onClick={handleContinue}
          disabled={selected.length === 0 || generating}
          className={`
            w-full py-3 rounded-xl text-sm font-medium transition-all
            ${
              selected.length > 0 && !generating
                ? "bg-gray-900 text-white hover:bg-gray-800"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }
          `}
        >
          {generating
            ? "正在分析并生成评论..."
            : selected.length === 0
              ? "请选择至少一位音乐家"
              : "开始聆听"}
        </button>
        {generating && (
          <p className="text-xs text-gray-400 text-center">
            音乐家正在并行点评，完成后会自动进入聆听页
          </p>
        )}
        {error && (
          <p className="text-xs text-red-500 text-center">{error}</p>
        )}
      </div>
    </div>
  );
}
