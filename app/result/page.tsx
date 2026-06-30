"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import FlowHeader from "@/components/FlowHeader";
import { getCharactersByIds, type Character } from "@/lib/characters";
import { getExperimentSessionId } from "@/lib/experiment-session";

interface GenerationMeta {
  runId?: string;
  sessionId?: string;
  provider?: string;
  model?: string;
  requestId?: string;
  promptSource?: string;
  promptDirector?: unknown;
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

interface FeedbackState {
  musicMatchScore: number;
  commentMatchScore: number;
  aestheticScore: number;
  selectedReasons: string[];
  freeText: string;
}

const FEEDBACK_REASONS = ["很准确", "情绪对", "风格不对", "太抽象", "不像音乐", "画面好看"];

const characterLabels: Record<string, { name: string; focus: string }> = {
  boya: { name: "伯牙", focus: "意" },
  jikang: { name: "嵇康", focus: "和" },
  caiwenji: { name: "蔡文姬", focus: "真" },
  abing: { name: "阿炳", focus: "苦" },
  tandun: { name: "谭盾", focus: "界" },
  bach: { name: "巴赫", focus: "序" },
  mozart: { name: "莫扎特", focus: "灵" },
  beethoven: { name: "贝多芬", focus: "力" },
  armstrong: { name: "阿姆斯特朗", focus: "活" },
  lennon: { name: "列侬", focus: "众" },
};

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
      generatedTime: "",
    };
  }

  const imageUrl = sessionStorage.getItem("generatedImageUrl");
  const comments = JSON.parse(sessionStorage.getItem("comments") || "{}") as Record<string, string>;
  const presets = JSON.parse(sessionStorage.getItem("imagePresets") || "null") as { style: string; mood: string; tone: string } | null;
  const characterIds = JSON.parse(sessionStorage.getItem("selectedCharacters") || "[]") as string[];
  const musicAnalysis = JSON.parse(sessionStorage.getItem("musicAnalysis") || "{}");
  const prompt = sessionStorage.getItem("generatedImagePrompt") || "";
  const remoteImageUrl = sessionStorage.getItem("generatedRemoteImageUrl") || "";
  const meta = JSON.parse(sessionStorage.getItem("imageGenerationMeta") || "null") as GenerationMeta | null;
  const audioUrl = sessionStorage.getItem("audioSrc") || sessionStorage.getItem("audioObjectUrl") || "";
  const audioName = (sessionStorage.getItem("audioFileName") || "音乐").replace(/\.\w+$/, "");
  const usePreviewData = !imageUrl && window.location.search.includes("page05-gallery-result");

  return {
    imageUrl: imageUrl || (usePreviewData ? "/generated/18d3ad2f-17ae-4daf-b2d5-16096bcf0491.png" : null),
    audioUrl: audioUrl || (usePreviewData ? "/preset-audio/music2image.mp3" : ""),
    audioName: audioName || "音乐",
    comments: usePreviewData
      ? {
          boya: "此曲有山风，竟若泉涌，弦外之音尚浅。",
          beethoven: "这里和命运搏斗的声音在推进，节奏里有不甘的意志。",
          abing: "这曲子急，像赶末班车。但太亮了，少了点嚼过苦的泥。",
          armstrong: "哟，这曲子跑得欢，亮堂堂的，有劲儿，节奏踩得稳。",
        }
      : comments,
    presets: presets || (usePreviewData ? { style: "水墨", mood: "激昂", tone: "暖色" } : null),
    characterIds: characterIds.length > 0 || !usePreviewData
      ? characterIds
      : ["boya", "beethoven", "abing", "armstrong"],
    debugInfo: {
      musicAnalysis: usePreviewData ? { tempo: "快速", energy: "高", brightness: "明亮", mood: "激昂" } : musicAnalysis,
      prompt: prompt || (usePreviewData ? "预览模式示例数据，用于查看第五页版式。" : ""),
      meta: meta || (usePreviewData ? { runId: "preview-run", sessionId: "preview-session", model: "preview" } : null),
      remoteImageUrl,
    },
    generatedTime: new Date().toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function getCharacterView(character: Character) {
  return characterLabels[character.id] || { name: character.name, focus: character.focusKeyword };
}

function GuideCommentCard({
  character,
  comment,
}: {
  character: Character;
  comment: string;
}) {
  const label = getCharacterView(character);

  return (
    <article className="flex min-h-0 gap-3 rounded-[18px] border border-[#a77b57]/34 bg-[#2b2530]/76 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="relative h-[74px] w-[66px] shrink-0 overflow-hidden rounded-[14px] border border-[#c99761]/34 bg-[#201b25]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/characters/stage/${character.id}.png`}
          alt={label.name}
          className="h-full w-full object-contain"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-[#ffe3bd]">{label.name}</h3>
          <span className="rounded-full border border-[#d7a464]/38 bg-[#3a2d32] px-2 py-0.5 text-[11px] text-[#ddb27b]">
            {label.focus}
          </span>
          <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-[#6bb36b] text-xs text-[#173017]">
            ✓
          </span>
        </div>
        <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-[#dec3a5]">
          {comment || "暂无点评。"}
        </p>
      </div>
    </article>
  );
}

export default function ResultPage() {
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [initialState] = useState(getInitialResultState);
  const [imageUrl, setImageUrl] = useState<string | null>(initialState.imageUrl);
  const [audioUrl] = useState<string>(initialState.audioUrl);
  const [audioName] = useState<string>(initialState.audioName);
  const [comments] = useState<Record<string, string>>(initialState.comments);
  const [presets] = useState<{ style: string; mood: string; tone: string } | null>(initialState.presets);
  const [characterIds] = useState<string[]>(initialState.characterIds);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(initialState.debugInfo);
  const [generatedTime] = useState(initialState.generatedTime);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showOverview, setShowOverview] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>({
    musicMatchScore: 4,
    commentMatchScore: 4,
    aestheticScore: 4,
    selectedReasons: [],
    freeText: "",
  });
  const [feedbackStatus, setFeedbackStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

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

  const handleStartOver = () => {
    sessionStorage.clear();
    router.push("/");
  };

  const handleRegenerateArtwork = async () => {
    const prompt = debugInfo?.prompt?.trim();
    if (!prompt || regenerating) return;

    setRegenerating(true);
    setRegenerateError(null);

    try {
      const sessionId =
        debugInfo?.meta?.sessionId ||
        sessionStorage.getItem("experimentSessionId") ||
        (await getExperimentSessionId());
      const commentList = characterIds
        .filter((characterId) => comments[characterId])
        .map((characterId) => ({
          characterId,
          text: comments[characterId],
        }));
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          selectedCharacters: characterIds,
          comments: commentList,
          presets,
          userNote: sessionStorage.getItem("userNote") || "",
          musicAnalysis: debugInfo?.musicAnalysis || {},
          promptOverride: prompt,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.imageUrl) {
        throw new Error(data.detail || data.error || "重新生成失败");
      }

      setImageUrl(data.imageUrl);
      const nextDebugInfo: DebugInfo = {
        musicAnalysis: debugInfo?.musicAnalysis,
        prompt: data.prompt || prompt,
        remoteImageUrl: data.remoteImageUrl || "",
        meta: {
          runId: data.runId,
          sessionId: data.sessionId || sessionId,
          provider: data.provider,
          model: data.model,
          requestId: data.requestId,
          promptSource: data.promptSource,
          promptDirector: data.promptDirector,
          logPath: data.logPath,
          timings: data.timings,
          usage: data.usage,
        },
      };
      setDebugInfo(nextDebugInfo);
      sessionStorage.setItem("generatedImageUrl", data.imageUrl);
      sessionStorage.setItem("generatedRemoteImageUrl", data.remoteImageUrl || "");
      sessionStorage.setItem("generatedImagePrompt", data.prompt || prompt);
      sessionStorage.setItem("experimentSessionId", data.sessionId || sessionId);
      sessionStorage.setItem("imageGenerationMeta", JSON.stringify(nextDebugInfo.meta));
    } catch (error) {
      setRegenerateError(error instanceof Error ? error.message : "重新生成失败");
    } finally {
      setRegenerating(false);
    }
  };

  const updateScore = (
    key: keyof Pick<FeedbackState, "musicMatchScore" | "commentMatchScore" | "aestheticScore">,
    score: number
  ) => {
    setFeedback((prev) => ({ ...prev, [key]: score }));
  };

  const toggleReason = (reason: string) => {
    setFeedback((prev) => ({
      ...prev,
      selectedReasons: prev.selectedReasons.includes(reason)
        ? prev.selectedReasons.filter((item) => item !== reason)
        : [...prev.selectedReasons, reason],
    }));
  };

  const submitFeedback = async () => {
    const runId = debugInfo?.meta?.runId;
    if (!runId || feedbackStatus === "saving" || feedbackStatus === "saved") return;

    setFeedbackStatus("saving");

    try {
      const sessionId =
        debugInfo?.meta?.sessionId ||
        sessionStorage.getItem("experimentSessionId") ||
        (await getExperimentSessionId());
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId,
          sessionId,
          ...feedback,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "反馈提交失败");
      }

      setFeedbackStatus("saved");
    } catch {
      setFeedbackStatus("error");
    }
  };

  if (!imageUrl) return null;

  const characters = getCharactersByIds(characterIds);
  const commentsForDebug = characterIds.map((characterId) => ({
    characterId,
    characterName: characters.find((char) => char.id === characterId)?.name || characterId,
    text: comments[characterId] || "",
  }));
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <main className="relative h-screen overflow-hidden bg-[#15111c] text-[#f8dfbb]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_36%,rgba(255,178,91,0.21),transparent_30%),radial-gradient(circle_at_78%_80%,rgba(255,179,90,0.16),transparent_28%),linear-gradient(135deg,#111420_0%,#2b2533_45%,#10121d_100%)]" />
      <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(115deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(25deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:180px_180px,220px_220px]" />
      <div className="pointer-events-none absolute left-[-5%] right-[-5%] top-[44%] flex h-32 items-center justify-center gap-1 opacity-55">
        {Array.from({ length: 170 }).map((_, index) => (
          <span
            key={index}
            className="w-1 rounded-full bg-[#d99b4d]"
            style={{
              height: `${(6 + Math.abs(Math.sin(index * 0.16)) * 68).toFixed(1)}px`,
              opacity: (0.2 + Math.abs(Math.sin(index * 0.21)) * 0.48).toFixed(3),
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex h-screen flex-col px-4 py-3 lg:px-6 lg:py-4 2xl:px-14 2xl:py-6">
        <FlowHeader activeStep={5} />

        <section
          className={`relative mt-3 grid min-h-0 flex-1 gap-4 overflow-hidden rounded-[26px] border border-[#9f6f45]/55 bg-[#251f2b]/38 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] 2xl:mt-5 ${
            showOverview
              ? "grid-cols-[220px_minmax(0,1fr)_360px] 2xl:grid-cols-[260px_minmax(0,1fr)_420px]"
              : "grid-cols-[76px_minmax(0,1fr)_360px] 2xl:grid-cols-[76px_minmax(0,1fr)_420px]"
          }`}
        >
          {showOverview ? (
            <aside className="flex min-h-0 flex-col rounded-[22px] border border-[#a77b57]/46 bg-[#241f2a]/72 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.24)] backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-[#ffe3bd]">生成概览</h2>
                  <p className="mt-2 text-xs leading-relaxed text-[#cdb297]">
                    你的音乐已经完成可视化，画作可保存，也可以回到开头重新生成。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowOverview(false)}
                  className="rounded-full border border-[#a77b57]/42 px-2 py-1 text-xs text-[#d7b99b] hover:border-[#ffd083]/70"
                >
                  收起
                </button>
              </div>
              <div className="mt-4 space-y-3 border-t border-[#8f6b52]/34 pt-4 text-xs text-[#d7b99b]">
                <p className="flex justify-between gap-3"><span>生成时间</span><span>{generatedTime}</span></p>
                <p className="flex justify-between gap-3"><span>画面来源</span><span>音乐与点评</span></p>
                <p className="flex justify-between gap-3"><span>导览数量</span><span>{characters.length || 0} 位</span></p>
                <p className="flex justify-between gap-3"><span>模型状态</span><span>{debugInfo?.meta?.model || "已生成"}</span></p>
              </div>
              <div className="mt-4 rounded-[18px] border border-[#a77b57]/34 bg-[#2d2732]/70 p-3">
                <p className="text-sm font-semibold text-[#ffe3bd]">生成参数</p>
                <div className="mt-3 grid gap-2 text-xs text-[#d7b99b]">
                  <span className="rounded-full border border-[#d7a464]/34 px-3 py-2">
                    风格：{presets?.style || "自动"}
                  </span>
                  <span className="rounded-full border border-[#d7a464]/34 px-3 py-2">
                    情绪：{presets?.mood || "自动"}
                  </span>
                  <span className="rounded-full border border-[#d7a464]/34 px-3 py-2">
                    光色：{presets?.tone || "自动"}
                  </span>
                </div>
              </div>
            </aside>
          ) : (
            <aside className="relative z-10 flex h-full w-[76px] shrink-0 items-start justify-center rounded-[22px] border border-[#a77b57]/36 bg-[#241f2a]/46 p-3 backdrop-blur">
              <button
                type="button"
                onClick={() => setShowOverview(true)}
                className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-[16px] border border-[#a77b57]/36 bg-[#2d2732]/58 text-[#ffe3bd] transition hover:border-[#ffd083]/70 hover:bg-[#3a2d32]/70"
              >
                <span className="text-lg">↗</span>
                <span className="text-xs leading-tight [writing-mode:vertical-rl]">生成概览</span>
              </button>
            </aside>
          )}

          <div className="relative min-w-0">
            <div className="absolute left-0 right-0 top-0 text-center">
              <h2 className="text-2xl font-semibold text-[#ffe3bd] 2xl:text-3xl">画作已生成</h2>
              <p className="mt-1 text-sm text-[#d7b99b]">来自音乐、导览点评和你的画面选择</p>
            </div>
            <div className="absolute right-[7%] top-[38px] z-20 flex gap-3">
              <button
                type="button"
                onClick={handleRegenerateArtwork}
                disabled={regenerating || !debugInfo?.prompt}
                aria-label="重新生成"
                title="用同一提示重新生成"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-[#ffd083]/42 bg-[#1f1923]/78 text-[#ffe3bd] shadow-[0_12px_34px_rgba(0,0,0,0.34)] backdrop-blur transition hover:border-[#ffd083]/80 hover:bg-[#3a2d32] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg className={`h-5 w-5 ${regenerating ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" />
                </svg>
              </button>
              <a
                href={imageUrl}
                download={`melodyvision-${debugInfo?.meta?.runId || "artwork"}.png`}
                aria-label="保存画作"
                title="保存画作"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-[#ffd083]/62 bg-[#4b3444]/86 text-[#ffe3bd] shadow-[0_12px_34px_rgba(0,0,0,0.34),0_0_20px_rgba(255,194,103,0.22)] backdrop-blur transition hover:border-[#ffd083] hover:bg-[#5a3b4d]"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v3h14v-3" />
                </svg>
              </a>
            </div>
            {regenerateError && (
              <p className="absolute left-0 right-0 top-[84px] text-center text-xs text-[#ff9f9f]">
                {regenerateError}
              </p>
            )}

            <div className="absolute left-1/2 top-[44px] inline-block max-w-full -translate-x-1/2 pt-11">
              <div className="relative inline-block rounded-[10px] border-[8px] border-[#8b5d32] bg-[#17131a] p-2 shadow-[0_30px_90px_rgba(0,0,0,0.5),0_0_38px_rgba(255,187,91,0.18)]">
                <div className="absolute inset-[-13px] -z-10 rounded-[14px] border border-[#efbd77]/46" />
                <div className="overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt="AI 生成的画作"
                    className="block max-h-[430px] max-w-[720px] object-contain 2xl:max-h-[560px] 2xl:max-w-[900px]"
                    onLoad={playResultAudio}
                  />
                </div>
              </div>
            </div>

            {audioUrl && (
              <>
                <audio
                  ref={audioRef}
                  src={audioUrl}
                  preload="auto"
                  onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
                  onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime || 0)}
                  onEnded={() => setIsAudioPlaying(false)}
                />
                <div className="absolute bottom-0 left-1/2 flex h-[74px] w-full max-w-[620px] -translate-x-1/2 items-center justify-center">
                  {showPlayer ? (
                    <div className="flex w-full items-center gap-4 rounded-[22px] border border-[#a77b57]/46 bg-[#241f2a]/84 px-5 py-2.5 text-left shadow-[0_18px_50px_rgba(0,0,0,0.3)] backdrop-blur">
                    <button
                      type="button"
                      onClick={toggleAudio}
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#f6d3a0] text-[#2b2230] shadow-[0_0_24px_rgba(255,203,127,0.38)]"
                    >
                      {isAudioPlaying ? "Ⅱ" : "▶"}
                    </button>
                    <span className="min-w-[120px]">
                      <span className="block text-sm font-semibold text-[#ffe3bd]">{audioName}</span>
                      <span className="block text-xs text-[#c8aa8e]">
                        {audioBlocked ? "点击播放音乐" : isAudioPlaying ? "正在随画面播放" : "点击播放音频"}
                      </span>
                    </span>
                    <span className="relative h-8 min-w-0 flex-1 overflow-hidden">
                      <span className="absolute left-0 right-0 top-1/2 h-px bg-[#8f6b52]/60" />
                      <span className="absolute left-0 top-1/2 h-px bg-[#ffd083]" style={{ width: `${progress}%` }} />
                      <span className="absolute inset-0 flex items-center gap-1">
                        {Array.from({ length: 52 }).map((_, index) => (
                          <span
                            key={index}
                            className="w-0.5 rounded-full bg-[#d99b4d]"
                            style={{ height: `${6 + Math.abs(Math.sin(index * 0.42)) * 24}px`, opacity: index / 52 <= progress / 100 ? 0.9 : 0.32 }}
                          />
                        ))}
                      </span>
                    </span>
                    <span className="text-xs tabular-nums text-[#d7b99b]">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPlayer(false)}
                      className="rounded-full border border-[#a77b57]/42 px-3 py-1.5 text-xs text-[#d7b99b] hover:border-[#ffd083]/70"
                    >
                      收起
                    </button>
                  </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowPlayer(true)}
                      className="flex items-center gap-2 rounded-full border border-[#ffd083]/42 bg-[#1f1923]/78 px-4 py-2 text-xs text-[#ffe3bd] shadow-[0_12px_34px_rgba(0,0,0,0.34)] backdrop-blur transition hover:border-[#ffd083]/80"
                    >
                      <span className="h-2 w-2 rounded-full bg-[#ffd083] shadow-[0_0_16px_rgba(255,208,131,0.8)]" />
                      {audioBlocked ? "展开播放控制" : isAudioPlaying ? "音乐播放中" : "展开播放控制"}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          <aside className="flex min-h-0 flex-col rounded-[22px] border border-[#a77b57]/46 bg-[#241f2a]/72 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.24)] backdrop-blur">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[#ffe3bd]">音乐家点评回顾</h2>
                <p className="mt-1 text-xs text-[#c7aa8d]">{characters.length} / {characters.length} 已收集</p>
              </div>
            </div>
            <div className="mt-4 grid min-h-0 flex-1 content-start gap-3 overflow-hidden">
              {characters.slice(0, 4).map((character) => (
                <GuideCommentCard
                  key={character.id}
                  character={character}
                  comment={comments[character.id] || ""}
                />
              ))}
            </div>
          </aside>

          <details className="absolute bottom-4 right-4 z-30 w-[348px] rounded-[18px] border border-[#a77b57]/44 bg-[#241f2a]/88 p-4 text-sm text-[#ffe3bd] shadow-[0_18px_50px_rgba(0,0,0,0.32)] backdrop-blur 2xl:w-[404px]">
            <summary className="cursor-pointer font-semibold">研究附录</summary>
            <div className="mt-4 max-h-[420px] overflow-auto pr-1">
              {debugInfo?.meta?.runId && (
                <div className="rounded-[16px] border border-[#8f6b52]/34 bg-[#2d2732]/78 p-3">
                  <p className="mb-3 text-sm font-semibold">这张图像符合你的听感吗？</p>
                  <div className="space-y-3">
                    {[
                      ["musicMatchScore", "像这首音乐"] as const,
                      ["commentMatchScore", "体现点评"] as const,
                      ["aestheticScore", "画面好看"] as const,
                    ].map(([key, label]) => (
                      <div key={key} className="flex items-center justify-between gap-3">
                        <span className="text-xs text-[#d7b99b]">{label}</span>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((score) => (
                            <button
                              key={score}
                              type="button"
                              onClick={() => updateScore(key, score)}
                              className={`h-7 w-7 rounded-full text-xs transition ${
                                feedback[key] >= score
                                  ? "bg-[#ffd083] text-[#2b2230]"
                                  : "bg-[#211b25] text-[#c8aa8e] hover:bg-[#3a2d32]"
                              }`}
                            >
                              {score}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    <div className="flex flex-wrap gap-2">
                      {FEEDBACK_REASONS.map((reason) => {
                        const selected = feedback.selectedReasons.includes(reason);
                        return (
                          <button
                            key={reason}
                            type="button"
                            onClick={() => toggleReason(reason)}
                            className={`rounded-full px-3 py-1.5 text-xs transition ${
                              selected
                                ? "bg-[#ffd083] text-[#2b2230]"
                                : "border border-[#8f6b52]/44 text-[#d7b99b] hover:border-[#ffd083]/60"
                            }`}
                          >
                            {reason}
                          </button>
                        );
                      })}
                    </div>
                    <textarea
                      value={feedback.freeText}
                      onChange={(event) => setFeedback((prev) => ({ ...prev, freeText: event.target.value }))}
                      placeholder="补充一句你的感受（可选）"
                      className="h-16 w-full resize-none rounded-[12px] border border-[#8f6b52]/44 bg-[#211b25] p-3 text-xs text-[#ffe3bd] outline-none placeholder:text-[#9f8066] focus:border-[#ffd083]/70"
                    />
                    <button
                      type="button"
                      onClick={submitFeedback}
                      disabled={feedbackStatus === "saving" || feedbackStatus === "saved"}
                      className="w-full rounded-[14px] bg-[#4b3444] py-3 text-sm font-semibold text-[#ffe3bd] transition hover:bg-[#5a3b4d] disabled:opacity-55"
                    >
                      {feedbackStatus === "saving" ? "提交中..." : feedbackStatus === "saved" ? "已记录" : "提交反馈"}
                    </button>
                    {feedbackStatus === "error" && (
                      <p className="text-center text-xs text-[#ff9f9f]">反馈提交失败，请稍后重试</p>
                    )}
                  </div>
                </div>
              )}

              {debugInfo && (
                <details className="mt-3 rounded-[16px] border border-[#8f6b52]/34 bg-[#2d2732]/78 p-3">
                  <summary className="cursor-pointer text-sm font-semibold">生成调试信息</summary>
                  <div className="mt-3 space-y-3 text-xs text-[#d7b99b]">
                    <pre className="max-h-32 overflow-auto rounded-[10px] bg-[#17131a] p-3 whitespace-pre-wrap">
                      {JSON.stringify(debugInfo.meta, null, 2)}
                    </pre>
                    <pre className="max-h-32 overflow-auto rounded-[10px] bg-[#17131a] p-3 whitespace-pre-wrap">
                      {JSON.stringify(debugInfo.musicAnalysis, null, 2)}
                    </pre>
                    <pre className="max-h-32 overflow-auto rounded-[10px] bg-[#17131a] p-3 whitespace-pre-wrap">
                      {JSON.stringify(commentsForDebug, null, 2)}
                    </pre>
                    <p className="max-h-32 overflow-auto rounded-[10px] bg-[#17131a] p-3 leading-relaxed whitespace-pre-wrap">
                      {debugInfo.prompt || "未记录"}
                    </p>
                    {debugInfo.remoteImageUrl && (
                      <p className="overflow-auto rounded-[10px] bg-[#17131a] p-3 break-all">
                        {debugInfo.remoteImageUrl}
                      </p>
                    )}
                  </div>
                </details>
              )}
            </div>
          </details>
          <button
            type="button"
            onClick={handleStartOver}
            className="absolute bottom-[88px] right-4 z-30 flex items-center gap-2 rounded-full border border-[#a77b57]/44 bg-[#241f2a]/88 px-4 py-2.5 text-sm font-semibold text-[#ffe3bd] shadow-[0_14px_38px_rgba(0,0,0,0.28)] backdrop-blur transition hover:border-[#ffd083]/70 hover:bg-[#302735]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" />
            </svg>
            重新开始
          </button>
        </section>
      </div>
    </main>
  );
}
