"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getCharactersByIds, Character } from "@/lib/characters";
import CharacterCard from "@/components/CharacterCard";
import CommentBubble from "@/components/CommentBubble";

export default function ListenPage() {
  const router = useRouter();
  const [selectedChars, setSelectedChars] = useState<Character[]>([]);
  const [allComments, setAllComments] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [userNote, setUserNote] = useState("");
  const [showUserInput, setShowUserInput] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioName, setAudioName] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const ids = JSON.parse(sessionStorage.getItem("selectedCharacters") || "[]");
    if (ids.length === 0) {
      router.push("/select");
      return;
    }
    setSelectedChars(getCharactersByIds(ids));

    const src = sessionStorage.getItem("audioSrc") || sessionStorage.getItem("audioObjectUrl") || "";
    const name = sessionStorage.getItem("audioFileName") || "音乐";
    setAudioName(name.replace(/\.\w+$/, ""));
    if (src) {
      const audio = new Audio(src);
      audio.loop = true;
      audio.addEventListener("ended", () => setIsPlaying(false));
      audioRef.current = audio;
    }

    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, [router]);

  useEffect(() => {
    if (
      selectedChars.length > 0 &&
      revealed.size === selectedChars.length
    ) {
      setTimeout(() => setShowUserInput(true), 600);
    }
  }, [revealed, selectedChars]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const fetchComment = useCallback(async (charId: string) => {
    const musicAnalysis = JSON.parse(
      sessionStorage.getItem("musicAnalysis") || "{}"
    );

    const res = await fetch("/api/comment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterId: charId,
        musicAnalysis,
      }),
    });

    if (!res.ok) throw new Error("Comment API failed");
    const data = await res.json();
    return data.comment as string;
  }, []);

  const handleReveal = async (charId: string) => {
    if (revealed.has(charId) || loading.has(charId)) return;

    setLoading((prev) => new Set(prev).add(charId));

    try {
      const comment = await fetchComment(charId);
      setAllComments((prev) => ({ ...prev, [charId]: comment }));
      setRevealed((prev) => new Set(prev).add(charId));
    } catch {
      setAllComments((prev) => ({
        ...prev,
        [charId]: "（评论生成失败，请重试）",
      }));
      setRevealed((prev) => new Set(prev).add(charId));
    } finally {
      setLoading((prev) => {
        const next = new Set(prev);
        next.delete(charId);
        return next;
      });
    }
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
          <p className="text-sm text-gray-500 mt-1">
            点击头像，听他怎么说
          </p>
        </div>

        {/* Audio player */}
        {audioRef.current && (
          <button
            onClick={togglePlay}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-all"
          >
            <span className={`flex items-center justify-center w-10 h-10 rounded-full ${isPlaying ? "bg-blue-500" : "bg-gray-900"} text-white shrink-0`}>
              {isPlaying ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </span>
            <div className="flex flex-col items-start">
              <span className="text-sm font-medium text-gray-800">{audioName}</span>
              <span className="text-xs text-gray-400">{isPlaying ? "正在播放" : "点击播放"}</span>
            </div>
            {isPlaying && (
              <div className="ml-auto flex items-center gap-0.5">
                {[1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className="w-1 bg-blue-500 rounded-full animate-pulse"
                    style={{ height: `${8 + Math.random() * 12}px`, animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            )}
          </button>
        )}

        {/* Character cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {selectedChars.map((char) => (
            <CharacterCard
              key={char.id}
              character={char}
              selected={revealed.has(char.id)}
              commented={revealed.has(char.id)}
              onClick={() => handleReveal(char.id)}
              disabled={loading.has(char.id)}
            />
          ))}
        </div>

        {/* Loading indicator */}
        {loading.size > 0 && (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>正在生成评论...</span>
          </div>
        )}

        {/* Comments */}
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

        {/* User note input */}
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
