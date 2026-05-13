"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCharactersByIds, Character } from "@/lib/characters";
import CharacterCard from "@/components/CharacterCard";
import CommentBubble from "@/components/CommentBubble";

export default function ListenPage() {
  const router = useRouter();
  const [selectedChars, setSelectedChars] = useState<Character[]>([]);
  const [allComments, setAllComments] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [preloading, setPreloading] = useState(true);
  const [userNote, setUserNote] = useState("");
  const [showUserInput, setShowUserInput] = useState(false);

  useEffect(() => {
    const ids = JSON.parse(sessionStorage.getItem("selectedCharacters") || "[]");
    if (ids.length === 0) {
      router.push("/select");
      return;
    }
    setSelectedChars(getCharactersByIds(ids));
  }, [router]);

  // Pre-generate all comments on mount
  useEffect(() => {
    if (selectedChars.length === 0) return;

    const mockComments: Record<string, string> = {
      boya: "此曲有山之巍峨，水之绵长，然弹者心不在焉。",
      shikuang: "此音合于黄钟，天下将有善政。",
      caiwenji: "这曲子……像我当年在草原上听到的风声，带着故乡的味道。",
      jikang: "你说它悲伤？悲伤在你心中，不在弦上。",
      baijuyi: "此曲好在不装，老妪能解，便是好曲。",
      jiangkui: "格律精严，有清气，可品。",
      zhuzaiyu: "五声音阶排列得当，无明显偏差。",
      abing: "我懂，我和你一样苦。",
      huangzhan: "好旋律！一听就忘不了，好听就是硬道理。",
      tandun: "这才是未来，音乐不该有固定的形态。",
    };

    // TODO: Call actual API to generate all comments in parallel
    // For now, mock with a brief delay to simulate preloading
    const timer = setTimeout(() => {
      const result: Record<string, string> = {};
      selectedChars.forEach((char) => {
        result[char.id] = mockComments[char.id] || "此曲甚妙。";
      });
      setAllComments(result);
      setPreloading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, [selectedChars]);

  // Check if all revealed
  useEffect(() => {
    if (
      selectedChars.length > 0 &&
      revealed.size === selectedChars.length
    ) {
      setTimeout(() => setShowUserInput(true), 600);
    }
  }, [revealed, selectedChars]);

  const handleReveal = (charId: string) => {
    if (revealed.has(charId)) return;
    setRevealed((prev) => new Set(prev).add(charId));
  };

  const handleContinue = () => {
    sessionStorage.setItem("comments", JSON.stringify(allComments));
    sessionStorage.setItem("userNote", userNote);
    router.push("/generate-page");
  };

  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-8">
      <div className="w-full max-w-lg flex flex-col gap-6">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">聆听与点评</h2>
          {preloading ? (
            <p className="text-sm text-gray-500 mt-1 flex items-center justify-center gap-2">
              <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              音乐家们正在聆听...
            </p>
          ) : (
            <p className="text-sm text-gray-500 mt-1">
              点击头像，听他怎么说
            </p>
          )}
        </div>

        {/* Character cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {selectedChars.map((char) => (
            <CharacterCard
              key={char.id}
              character={char}
              selected={false}
              commented={revealed.has(char.id)}
              onClick={() => handleReveal(char.id)}
              disabled={preloading}
            />
          ))}
        </div>

        {/* Comments — revealed ones stay visible */}
        <div className="flex flex-col gap-4">
          {selectedChars.map(
            (char) =>
              revealed.has(char.id) && allComments[char.id] && (
                <CommentBubble
                  key={char.id}
                  characterName={char.name}
                  focusKeyword={char.focusKeyword}
                  text={allComments[char.id]}
                  visible={true}
                />
              )
          )}
        </div>

        {/* User note input — shows after all revealed */}
        {showUserInput && (
          <div className="w-full animate-in fade-in duration-500">
            <p className="text-sm text-gray-500 mb-2 text-center">你想说点什么？</p>
            <textarea
              value={userNote}
              onChange={(e) => setUserNote(e.target.value)}
              placeholder="分享你的感受（可选）"
              className="w-full p-3 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:border-gray-400"
              rows={2}
            />
            <button
              onClick={handleContinue}
              className="w-full mt-3 py-3 rounded-xl text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 transition-all"
            >
              生成画作
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
