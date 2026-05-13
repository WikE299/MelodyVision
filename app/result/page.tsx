"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCharactersByIds } from "@/lib/characters";
import CommentBubble from "@/components/CommentBubble";

export default function ResultPage() {
  const router = useRouter();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [presets, setPresets] = useState<{ style: string; mood: string; tone: string } | null>(null);
  const [characterIds, setCharacterIds] = useState<string[]>([]);

  useEffect(() => {
    const url = sessionStorage.getItem("generatedImageUrl");
    const commentsData = JSON.parse(sessionStorage.getItem("comments") || "{}");
    const presetsData = JSON.parse(sessionStorage.getItem("imagePresets") || "null");
    const chars = JSON.parse(sessionStorage.getItem("selectedCharacters") || "[]");

    if (!url) {
      router.push("/");
      return;
    }

    setImageUrl(url);
    setComments(commentsData);
    setPresets(presetsData);
    setCharacterIds(chars);
  }, [router]);

  const characters = getCharactersByIds(characterIds);

  const handleRestart = () => {
    sessionStorage.clear();
    router.push("/");
  };

  if (!imageUrl) return null;

  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-8">
      <div className="w-full max-w-lg flex flex-col items-center gap-6">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">画作已生成</h2>
          {presets && (
            <p className="text-sm text-gray-500 mt-1">
              {presets.style}风格 · {presets.mood}情绪 · {presets.tone}色调
            </p>
          )}
        </div>

        {/* Generated image */}
        <div className="w-full aspect-square rounded-2xl overflow-hidden bg-gray-100 shadow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="AI 生成的画作"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Comments review */}
        <div className="w-full">
          <h3 className="text-sm font-medium text-gray-700 mb-3 text-center">
            音乐家点评回顾
          </h3>
          <div className="flex flex-col gap-3">
            {characters.map((char) => (
              <CommentBubble
                key={char.id}
                characterName={char.name}
                focusKeyword={char.focusKeyword}
                text={comments[char.id] || ""}
                visible={true}
              />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 w-full">
          <button
            onClick={handleRestart}
            className="flex-1 py-3 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all"
          >
            重新开始
          </button>
          <button
            onClick={() => {
              // TODO: Implement save functionality
              alert("保存功能即将上线");
            }}
            className="flex-1 py-3 rounded-xl text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 transition-all"
          >
            保存画作
          </button>
        </div>
      </div>
    </div>
  );
}
