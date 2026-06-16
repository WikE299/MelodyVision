"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getCharactersByIds } from "@/lib/characters";
import CommentBubble from "@/components/CommentBubble";

interface GenerationMeta {
  runId?: string;
  provider?: string;
  model?: string;
  requestId?: string;
  promptSource?: string;
  logPath?: string;
  timings?: Record<string, number>;
  usage?: unknown;
}

interface DebugInfo {
  musicAnalysis: unknown;
  prompt: string;
  meta: GenerationMeta | null;
  remoteImageUrl: string;
}

function getInitialResultState() {
  if (typeof window === "undefined") {
    return {
      imageUrl: null as string | null,
      audioUrl: "",
      audioName: "音乐",
      comments: {} as Record<string, string>,
      presets: null as { style: string; mood: string; tone: string } | null,
      characterIds: [] as string[],
      debugInfo: null as DebugInfo | null,
    };
  }

  const imageUrl = sessionStorage.getItem("generatedImageUrl");
  const comments = JSON.parse(sessionStorage.getItem("comments") || "{}");
  const presets = JSON.parse(sessionStorage.getItem("imagePresets") || "null");
  const characterIds = JSON.parse(sessionStorage.getItem("selectedCharacters") || "[]");
  const musicAnalysis = JSON.parse(sessionStorage.getItem("musicAnalysis") || "{}");
  const prompt = sessionStorage.getItem("generatedImagePrompt") || "";
  const remoteImageUrl = sessionStorage.getItem("generatedRemoteImageUrl") || "";
  const meta = JSON.parse(sessionStorage.getItem("imageGenerationMeta") || "null");
  const audioUrl =
    sessionStorage.getItem("audioSrc") ||
    sessionStorage.getItem("audioObjectUrl") ||
    "";
  const audioName = (sessionStorage.getItem("audioFileName") || "音乐").replace(/\.\w+$/, "");

  return {
    imageUrl,
    audioUrl,
    audioName,
    comments,
    presets,
    characterIds,
    debugInfo: {
      musicAnalysis,
      prompt,
      meta,
      remoteImageUrl,
    },
  };
}

export default function ResultPage() {
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [initialState] = useState(getInitialResultState);
  const [imageUrl] = useState<string | null>(initialState.imageUrl);
  const [audioUrl] = useState<string>(initialState.audioUrl);
  const [audioName] = useState<string>(initialState.audioName);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [comments] = useState<Record<string, string>>(initialState.comments);
  const [presets] = useState<{ style: string; mood: string; tone: string } | null>(initialState.presets);
  const [characterIds] = useState<string[]>(initialState.characterIds);
  const [debugInfo] = useState<DebugInfo | null>(initialState.debugInfo);

  useEffect(() => {
    if (!imageUrl) {
      router.push("/");
    }
  }, [imageUrl, router]);

  const playResultAudio = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      audio.loop = true;
      await audio.play();
      setIsAudioPlaying(true);
      setAudioBlocked(false);
    } catch {
      setIsAudioPlaying(false);
      setAudioBlocked(true);
    }
  }, []);

  const toggleAudio = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isAudioPlaying) {
      audio.pause();
      setIsAudioPlaying(false);
      return;
    }

    await playResultAudio();
  };

  const characters = getCharactersByIds(characterIds);
  const commentsForDebug = characterIds.map((characterId) => ({
    characterId,
    characterName: characters.find((char) => char.id === characterId)?.name || characterId,
    text: comments[characterId] || "",
  }));

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

        {audioUrl && (
          <audio
            ref={audioRef}
            src={audioUrl}
            preload="auto"
            onEnded={() => setIsAudioPlaying(false)}
          />
        )}

        {/* Generated image */}
        <div className="w-full aspect-square rounded-2xl overflow-hidden bg-gray-100 shadow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="AI 生成的画作"
            className="w-full h-full object-cover"
            onLoad={playResultAudio}
          />
        </div>

        {audioUrl && (
          <button
            onClick={toggleAudio}
            className="w-full flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-left hover:bg-gray-50 transition-colors"
          >
            <span className="flex flex-col">
              <span className="text-sm font-medium text-gray-800">{audioName}</span>
              <span className="text-xs text-gray-400">
                {audioBlocked
                  ? "浏览器拦截了自动播放，点击继续声画同出"
                  : isAudioPlaying
                  ? "正在随画面播放"
                  : "点击播放音频"}
              </span>
            </span>
            <span className={`flex h-9 w-9 items-center justify-center rounded-full ${isAudioPlaying ? "bg-blue-500" : "bg-gray-900"} text-white`}>
              {isAudioPlaying ? (
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg className="h-4 w-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </span>
          </button>
        )}

        {/* Comments review */}
        <div className="w-full">
          <h3 className="text-sm font-medium text-gray-700 mb-3 text-center">
            音乐家点评回顾
          </h3>
          <div className="flex flex-col gap-3">
            {characters.map((char) => (
              <CommentBubble
                key={char.id}
                characterId={char.id}
                characterName={char.name}
                focusKeyword={char.focusKeyword}
                text={comments[char.id] || ""}
                visible={true}
              />
            ))}
          </div>
        </div>

        {/* Debug info */}
        {debugInfo && (
          <details className="w-full rounded-xl border border-gray-200 bg-white p-4">
            <summary className="cursor-pointer text-sm font-medium text-gray-700">
              生成调试信息
            </summary>
            <div className="mt-4 flex flex-col gap-4 text-xs text-gray-600">
              <div>
                <p className="font-medium text-gray-800 mb-1">运行信息</p>
                <pre className="overflow-auto rounded-lg bg-gray-50 p-3 whitespace-pre-wrap">
                  {JSON.stringify(debugInfo.meta, null, 2)}
                </pre>
              </div>

              <div>
                <p className="font-medium text-gray-800 mb-1">音频分析</p>
                <pre className="overflow-auto rounded-lg bg-gray-50 p-3 whitespace-pre-wrap">
                  {JSON.stringify(debugInfo.musicAnalysis, null, 2)}
                </pre>
              </div>

              <div>
                <p className="font-medium text-gray-800 mb-1">角色评论</p>
                <pre className="overflow-auto rounded-lg bg-gray-50 p-3 whitespace-pre-wrap">
                  {JSON.stringify(commentsForDebug, null, 2)}
                </pre>
              </div>

              <div>
                <p className="font-medium text-gray-800 mb-1">最终生图 Prompt</p>
                <p className="rounded-lg bg-gray-50 p-3 leading-relaxed whitespace-pre-wrap">
                  {debugInfo.prompt || "未记录"}
                </p>
              </div>

              {debugInfo.remoteImageUrl && (
                <div>
                  <p className="font-medium text-gray-800 mb-1">百炼临时图片 URL</p>
                  <p className="overflow-auto rounded-lg bg-gray-50 p-3 break-all">
                    {debugInfo.remoteImageUrl}
                  </p>
                </div>
              )}
            </div>
          </details>
        )}

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
