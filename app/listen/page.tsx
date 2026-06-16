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
      boya: "此曲清婉有余，深意不足。若弹琴之人能在花香里藏一分月光，便不止于好听。",
      jikang: "此曲之和，在于不刻意。五音各安其位，有自然之趣。但你说它美、他说它悲，那是你们的事。",
      caiwenji: "这曲子太干净了……像没有受过伤的人写的。真正动人的曲子，弦上要有泪痕。",
      abing: "这曲子……甜。太甜了。像是没饿过饭的人写的。不过也好，谁不想日子甜一点呢。",
      tandun: "这条旋律是一条河，从江南流出来。但它不应该只流在古筝和琵琶里——让它流到水里、风里去。",
      bach: "这条旋律质朴如圣咏，可惜独行无伴。若为它配上三个声部，让它们彼此追逐又彼此成全——便是一首东方赋格。",
      mozart: "这旋律是自己长出来的，不是写出来的！一个多余的音都没有。不过……请允许我为它写十二段变奏。",
      beethoven: "美，但太温顺了。它在花园里散步，从不抬头看天上的雷雨。给我一个转调，让它挣扎一次！",
      armstrong: "好旋律，自己会走路！要是再给它一点点切分——先生，它就不是走路了，它会跳舞。",
      lennon: "我不懂五声音阶，可我跟着哼一遍就会了——这就是本事。简单不是缺点，是诚实。",
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
              selected={revealed.has(char.id)}
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
                  characterId={char.id}
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
