"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import FlowHeader from "@/components/FlowHeader";
import { getCharactersByIds, type Character } from "@/lib/characters";
import { getExperimentSessionId } from "@/lib/experiment-session";
import { recordExperimentEvent } from "@/lib/experiment-events";
import { characterUi, type Language, useHydrated, useLanguage } from "@/lib/i18n";
import type {
  ConversationState,
  MusicProfile,
  VisualBrief,
  VisualBriefFieldKey,
} from "@/lib/contracts";

interface PromptDirectorResultView {
  userSourceMappings?: Array<{
    sourceId: string;
    visualTranslation: string;
  }>;
  visualBriefMappings?: Array<{
    field: VisualBriefFieldKey;
    status: string;
    visualTranslation: string;
  }>;
  sourceMappings?: Array<{
    characterId: string;
    speaker: string;
    visualTranslation: string;
  }>;
}

interface PromptDirectorTrace {
  source?: string;
  result?: PromptDirectorResultView | null;
  repaired?: boolean;
}

interface GenerationMeta {
  runId?: string;
  sessionId?: string;
  provider?: string;
  model?: string;
  imageSize?: string;
  requestId?: string;
  promptSource?: string;
  promptDirector?: PromptDirectorTrace | null;
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

const FEEDBACK_REASONS = {
  zh: ["很准确", "情绪对", "风格不对", "太抽象", "不像音乐", "画面好看"],
  en: ["Accurate", "Right mood", "Wrong style", "Too abstract", "Not musical", "Beautiful image"],
};

const COPY = {
  zh: {
    audioName: "音乐",
    emptyComment: "暂无点评。",
    regenerateFailed: "重新生成失败",
    feedbackFailed: "反馈提交失败",
    overviewTitle: "生成依据",
    overviewText: "查看你的画面、共创线索与音乐家视角如何进入这幅画。",
    collapse: "收起",
    generatedAt: "生成时间",
    imageSource: "画面来源",
    sourceValue: "音乐 + 共创对话 + 你的画面",
    guideCount: "导览数量",
    modelStatus: "模型状态",
    generated: "已生成",
    userAnchor: "你的画面",
    coCreationClues: "共创线索",
    musicianClues: "音乐家视角",
    noRationale: "当前结果来自旧版流程，暂无逐项来源记录。",
    fieldLabels: {
      subject: "主体",
      space: "空间",
      composition: "构图",
      motion: "动势",
      materials: "材质",
      palette: "色彩",
      lighting: "光线",
      atmosphere: "氛围",
      personalMeaning: "个人意义",
      mustInclude: "必须保留",
      mustAvoid: "需要避开",
    },
    overviewRail: "生成依据",
    title: "画作已生成",
    subtitle: "来自音乐、共创对话和你的画面",
    regenerate: "重新生成",
    regenerateTip: "用同一提示重新生成",
    save: "保存画作",
    imageAlt: "AI 生成的画作",
    clickMusic: "点击播放音乐",
    playingWithImage: "正在随画面播放",
    clickAudio: "点击播放音频",
    collapsePlayerTip: "收起播放控制",
    expandControl: "展开播放控制",
    musicPlaying: "音乐播放中",
    expandProgressTip: "展开音乐播放进度",
    reviewTitle: "音乐家点评回顾",
    collected: "已收集",
    appendix: "研究附录",
    feedbackTitle: "这张图像符合你的听感吗？",
    musicMatch: "像这首音乐",
    commentMatch: "体现点评",
    aesthetic: "画面好看",
    feedbackPlaceholder: "补充一句你的感受（可选）",
    submitting: "提交中...",
    saved: "已记录",
    submit: "提交反馈",
    feedbackError: "反馈提交失败，请稍后重试",
    debug: "生成调试信息",
    notRecorded: "未记录",
    startOver: "重新开始",
    startOverTip: "清空当前流程，回到首页",
    replayTitle: "共同聆听的回声",
    you: "你",
    overview: "查看生成依据",
  },
  en: {
    audioName: "Music",
    emptyComment: "No comment yet.",
    regenerateFailed: "Regeneration failed",
    feedbackFailed: "Failed to submit feedback",
    overviewTitle: "Generation Rationale",
    overviewText: "See how your image, co-created cues, and musician perspectives shaped this artwork.",
    collapse: "Close",
    generatedAt: "Generated",
    imageSource: "Source",
    sourceValue: "Music + co-creation + your image",
    guideCount: "Guides",
    modelStatus: "Model",
    generated: "Generated",
    userAnchor: "Your Image",
    coCreationClues: "Co-created Cues",
    musicianClues: "Musician Perspectives",
    noRationale: "This result came from the legacy flow and has no field-level source record.",
    fieldLabels: {
      subject: "Subject",
      space: "Space",
      composition: "Composition",
      motion: "Motion",
      materials: "Materials",
      palette: "Color",
      lighting: "Lighting",
      atmosphere: "Atmosphere",
      personalMeaning: "Personal Meaning",
      mustInclude: "Must Include",
      mustAvoid: "Must Avoid",
    },
    overviewRail: "Overview",
    title: "Artwork Generated",
    subtitle: "Built from the music, co-created conversation, and your image",
    regenerate: "Regenerate",
    regenerateTip: "Regenerate with the same prompt",
    save: "Save artwork",
    imageAlt: "AI-generated artwork",
    clickMusic: "Click to play music",
    playingWithImage: "Playing with the artwork",
    clickAudio: "Click to play audio",
    collapsePlayerTip: "Hide playback controls",
    expandControl: "Show playback controls",
    musicPlaying: "Music playing",
    expandProgressTip: "Show music progress",
    reviewTitle: "Musician Comment Recap",
    collected: "Collected",
    appendix: "Research Appendix",
    feedbackTitle: "Does this image match what you heard?",
    musicMatch: "Matches the music",
    commentMatch: "Reflects comments",
    aesthetic: "Looks good",
    feedbackPlaceholder: "Add one more thought (optional)",
    submitting: "Submitting...",
    saved: "Saved",
    submit: "Submit feedback",
    feedbackError: "Feedback failed. Please try again later.",
    debug: "Generation Debug Info",
    notRecorded: "Not recorded",
    startOver: "Start over",
    startOverTip: "Clear this flow and return home",
    replayTitle: "Echoes from the shared listening",
    you: "You",
    overview: "View generation rationale",
  },
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
      negativePrompt: "",
      visualBrief: null as VisualBrief | null,
      conversationState: null as ConversationState | null,
      musicProfile: null as MusicProfile | null,
      generatedTime: "",
    };
  }

  const imageUrl = sessionStorage.getItem("generatedImageUrl");
  const comments = JSON.parse(sessionStorage.getItem("comments") || "{}") as Record<string, string>;
  const presets = JSON.parse(sessionStorage.getItem("imagePresets") || "null") as { style: string; mood: string; tone: string } | null;
  const characterIds = JSON.parse(sessionStorage.getItem("selectedCharacters") || "[]") as string[];
  const musicAnalysis = JSON.parse(sessionStorage.getItem("musicAnalysis") || "{}");
  const prompt = sessionStorage.getItem("generatedImagePrompt") || "";
  const negativePrompt = sessionStorage.getItem("generatedNegativePrompt") || "";
  const remoteImageUrl = sessionStorage.getItem("generatedRemoteImageUrl") || "";
  const meta = JSON.parse(sessionStorage.getItem("imageGenerationMeta") || "null") as GenerationMeta | null;
  const audioUrl = sessionStorage.getItem("audioSrc") || sessionStorage.getItem("audioObjectUrl") || "";
  const audioName = (sessionStorage.getItem("audioFileName") || "音乐").replace(/\.\w+$/, "");
  const visualBrief = JSON.parse(sessionStorage.getItem("visualBrief") || "null") as VisualBrief | null;
  const conversationState = JSON.parse(sessionStorage.getItem("conversationState") || "null") as ConversationState | null;
  const musicProfile = JSON.parse(sessionStorage.getItem("musicProfile") || "null") as MusicProfile | null;
  const usePreviewData = !imageUrl && window.location.search.includes("page05-gallery-result");

  return {
    imageUrl: imageUrl || (usePreviewData ? "/preview/cinema-landscape.jpg" : null),
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
    negativePrompt,
    visualBrief,
    conversationState,
    musicProfile,
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

function getCharacterView(character: Character, language: Language) {
  return characterUi[language][character.id as keyof typeof characterUi.zh] || { name: character.name, focus: character.focusDescription };
}

function briefFieldText(
  brief: VisualBrief | null,
  field: VisualBriefFieldKey,
  fallback: string
) {
  const value = brief?.fields[field].value;
  if (Array.isArray(value)) return value.join(" · ");
  return value || fallback;
}

export default function ResultPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const copy = COPY[language];
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const resultViewRecordedRef = useRef(false);
  const mounted = useHydrated();
  const [initialState] = useState(getInitialResultState);
  const [imageUrl, setImageUrl] = useState<string | null>(initialState.imageUrl);
  const [audioUrl] = useState<string>(initialState.audioUrl);
  const [audioName] = useState<string>(initialState.audioName);
  const [comments] = useState<Record<string, string>>(initialState.comments);
  const [presets] = useState<{ style: string; mood: string; tone: string } | null>(initialState.presets);
  const [characterIds] = useState<string[]>(initialState.characterIds);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(initialState.debugInfo);
  const [negativePrompt] = useState(initialState.negativePrompt);
  const [visualBrief] = useState(initialState.visualBrief);
  const [conversationState] = useState(initialState.conversationState);
  const [musicProfile] = useState(initialState.musicProfile);
  const [generatedTime] = useState(initialState.generatedTime);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showOverview, setShowOverview] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const [showAppendix, setShowAppendix] = useState(false);
  const [pausedDanmakuLane, setPausedDanmakuLane] = useState<number | null>(null);
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
      return;
    }
    if (resultViewRecordedRef.current) return;
    resultViewRecordedRef.current = true;
    recordExperimentEvent("result-viewed", "/result", {
      runId: initialState.debugInfo?.meta?.runId || null,
    });
  }, [imageUrl, initialState.debugInfo?.meta?.runId, router]);

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
    recordExperimentEvent("flow-restarted", "/result", {
      runId: debugInfo?.meta?.runId || null,
    });
    sessionStorage.clear();
    router.push("/");
  };

  const handleRegenerateArtwork = async () => {
    const prompt = debugInfo?.prompt?.trim();
    if (!prompt || regenerating) return;

    setRegenerating(true);
    setRegenerateError(null);
    recordExperimentEvent("regeneration-started", "/result", {
      runId: debugInfo?.meta?.runId || null,
    });

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
          negativePrompt,
          ...(visualBrief && conversationState
            ? { visualBrief, conversationState, musicProfile }
            : {}),
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.imageUrl) {
        throw new Error(data.detail || data.error || copy.regenerateFailed);
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
          imageSize: data.imageSize,
          requestId: data.requestId,
          promptSource: data.promptSource,
          promptDirector: debugInfo?.meta?.promptDirector || data.promptDirector,
          logPath: data.logPath,
          timings: data.timings,
          usage: data.usage,
        },
      };
      setDebugInfo(nextDebugInfo);
      sessionStorage.setItem("generatedImageUrl", data.imageUrl);
      sessionStorage.setItem("generatedRemoteImageUrl", data.remoteImageUrl || "");
      sessionStorage.setItem("generatedImagePrompt", data.prompt || prompt);
      sessionStorage.setItem("generatedNegativePrompt", data.negativePrompt || negativePrompt);
      sessionStorage.setItem("experimentSessionId", data.sessionId || sessionId);
      sessionStorage.setItem("imageGenerationMeta", JSON.stringify(nextDebugInfo.meta));
    } catch (error) {
      setRegenerateError(error instanceof Error ? error.message : copy.regenerateFailed);
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
        throw new Error(data.error || copy.feedbackFailed);
      }

      setFeedbackStatus("saved");
    } catch {
      setFeedbackStatus("error");
    }
  };

  if (!mounted || !imageUrl) return null;

  const characters = getCharactersByIds(characterIds);
  const commentsForDebug = characterIds.map((characterId) => ({
    characterId,
    characterName: characters.find((char) => char.id === characterId)?.name || characterId,
    text: comments[characterId] || "",
  }));
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const promptDirectorResult = debugInfo?.meta?.promptDirector?.result || null;
  const userRationale = promptDirectorResult?.userSourceMappings || [];
  const briefRationale = promptDirectorResult?.visualBriefMappings || [];
  const musicianRationale = promptDirectorResult?.sourceMappings || [];
  const conversationUserMessages = conversationState?.messages.filter(
    (message) => message.role === "user"
  ) || [];
  const hasRationale = userRationale.length + briefRationale.length + musicianRationale.length > 0;
  const replayMessages = conversationState?.messages
    .filter((message) => (message.role === "musician" || message.role === "user") && message.content.trim())
    .map((message) => {
      const speakerCharacter = characters.find((character) => character.id === message.speakerId);
      return {
        id: message.id,
        speaker: message.role === "user"
          ? copy.you
          : speakerCharacter
            ? getCharacterView(speakerCharacter, language).name
            : message.speakerId,
        content: message.content,
        role: message.role,
      };
    }) || [];
  const danmakuMessages = replayMessages.length > 0
    ? replayMessages
    : characters.flatMap((character) => comments[character.id]
      ? [{
          id: `comment-${character.id}`,
          speaker: getCharacterView(character, language).name,
          content: comments[character.id],
          role: "musician" as const,
        }]
      : []);
  const danmakuLanes = [
    danmakuMessages.filter((_, index) => index % 2 === 0),
    danmakuMessages.filter((_, index) => index % 2 === 1),
  ].filter((lane) => lane.length > 0);

  return (
    <main className="relative h-screen overflow-hidden bg-[#111019] text-[#f8dfbb]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_46%,rgba(208,139,74,0.18),transparent_38%),linear-gradient(135deg,#0d1019_0%,#241f2b_48%,#0c0e16_100%)]" />
      <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(115deg,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(25deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:190px_190px,230px_230px]" />

      <div className="relative z-10 flex h-screen flex-col px-4 py-3 lg:px-6 lg:py-4 2xl:px-12 2xl:py-5">
        <FlowHeader activeStep={4} compact />
        <section className="relative mt-2 min-h-0 flex-1 overflow-hidden rounded-[20px] border border-[#9f6f45]/46 bg-[#1d1923]/34 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">

          <div className="absolute right-5 top-4 z-50 flex gap-3">
              <div className="group relative">
                <button
                  type="button"
                  onClick={handleRegenerateArtwork}
                  disabled={regenerating || !debugInfo?.prompt}
                  aria-label={copy.regenerate}
                  title={copy.regenerateTip}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-[#ffd083]/42 bg-[#1f1923]/78 text-[#ffe3bd] shadow-[0_12px_34px_rgba(0,0,0,0.34)] backdrop-blur transition hover:border-[#ffd083]/80 hover:bg-[#3a2d32] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <svg className={`h-5 w-5 ${regenerating ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" />
                  </svg>
                </button>
                <span className="pointer-events-none absolute left-1/2 top-[52px] z-40 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#a77b57]/44 bg-[#1f1923]/92 px-3 py-1.5 text-xs text-[#ffe3bd] opacity-0 shadow-[0_10px_24px_rgba(0,0,0,0.3)] transition group-hover:opacity-100">
                  {copy.regenerateTip}
                </span>
              </div>
              <div className="group relative">
                <a
                  href={imageUrl}
                  download={`melodyvision-${debugInfo?.meta?.runId || "artwork"}.png`}
                  onClick={() => recordExperimentEvent("artwork-downloaded", "/result", {
                    runId: debugInfo?.meta?.runId || null,
                  })}
                  aria-label={copy.save}
                  title={copy.save}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-[#ffd083]/62 bg-[#4b3444]/86 text-[#ffe3bd] shadow-[0_12px_34px_rgba(0,0,0,0.34),0_0_20px_rgba(255,194,103,0.22)] backdrop-blur transition hover:border-[#ffd083] hover:bg-[#5a3b4d]"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v3h14v-3" />
                  </svg>
                </a>
                <span className="pointer-events-none absolute left-1/2 top-[52px] z-40 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#a77b57]/44 bg-[#1f1923]/92 px-3 py-1.5 text-xs text-[#ffe3bd] opacity-0 shadow-[0_10px_24px_rgba(0,0,0,0.3)] transition group-hover:opacity-100">
                  {copy.save}
                </span>
              </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowOverview(true);
              recordExperimentEvent("rationale-opened", "/result", {
                runId: debugInfo?.meta?.runId || null,
              });
            }}
            aria-label={copy.overview}
            title={copy.overview}
            className="absolute left-5 top-4 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-[#ffd083]/42 bg-[#1f1923]/78 text-lg text-[#ffe3bd] shadow-[0_12px_34px_rgba(0,0,0,0.34)] backdrop-blur transition hover:border-[#ffd083]/80 hover:bg-[#3a2d32]"
          >
            ↗
          </button>

          {regenerateError && (
            <p className="absolute left-1/2 top-16 z-50 -translate-x-1/2 text-xs text-[#ff9f9f]">{regenerateError}</p>
          )}

          <div className="absolute inset-x-6 bottom-[96px] top-[56px] flex items-center justify-center xl:top-3">
            <div className="relative flex h-full w-full items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={copy.imageAlt}
                className="block max-h-full max-w-full rounded-[6px] object-contain shadow-[0_34px_110px_rgba(0,0,0,0.62),0_0_45px_rgba(255,187,91,0.16)] ring-1 ring-[#efbd77]/38"
                onLoad={playResultAudio}
              />
            </div>
          </div>

          {!showPlayer && (
          <div className={`absolute bottom-1 left-[170px] z-40 h-[76px] overflow-hidden border-y border-[#9f6f45]/22 bg-[#15131c]/48 py-1 backdrop-blur-sm transition-[right] ${showAppendix ? "right-[370px]" : "right-[240px]"}`} aria-label={copy.replayTitle}>
            {danmakuLanes.map((lane, laneIndex) => (
              <div key={laneIndex} className="mv-danmaku-lane h-1/2 overflow-hidden">
                <div
                  className="mv-danmaku-track flex h-full w-max min-w-max items-center"
                  style={{
                    animationDuration: `${38 + laneIndex * 8}s`,
                    animationPlayState: pausedDanmakuLane === laneIndex ? "paused" : "running",
                  }}
                >
                  {[0, 1].map((copyIndex) => (
                    <div
                      key={copyIndex}
                      className="flex min-w-[100vw] shrink-0 items-center gap-10 pr-10"
                      aria-hidden={copyIndex === 1}
                    >
                      {lane.map((message) => (
                        <p
                          key={`${copyIndex}-${message.id}`}
                          className={`mv-danmaku-item max-w-[min(54rem,74vw)] shrink-0 cursor-default truncate whitespace-nowrap rounded-full border px-4 py-1.5 text-xs shadow-[0_6px_18px_rgba(0,0,0,0.24)] transition-colors ${
                            message.role === "user"
                              ? "border-[#f2c675]/58 bg-[#694938]/88 text-[#fff0d4]"
                              : "border-white/16 bg-[#211d27]/88 text-[#f5ddbf]"
                          }`}
                          title={message.content}
                          onMouseEnter={() => setPausedDanmakuLane(laneIndex)}
                          onMouseLeave={() => setPausedDanmakuLane(null)}
                        >
                          <strong className="mr-2 font-semibold text-[#ffd28f]">{message.speaker}</strong>
                          {message.content}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          )}

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
                <div className={`absolute bottom-1 left-4 z-50 flex h-[76px] items-center justify-center transition-[width] ${showPlayer ? "w-[620px]" : "w-[145px]"}`}>
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
                        {audioBlocked ? copy.clickMusic : isAudioPlaying ? copy.playingWithImage : copy.clickAudio}
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
                      className="group relative rounded-full border border-[#a77b57]/42 px-3 py-1.5 text-xs text-[#d7b99b] hover:border-[#ffd083]/70"
                    >
                      {copy.collapse}
                      <span className="pointer-events-none absolute bottom-[38px] left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#a77b57]/44 bg-[#1f1923]/92 px-3 py-1.5 text-xs text-[#ffe3bd] opacity-0 shadow-[0_10px_24px_rgba(0,0,0,0.3)] transition group-hover:opacity-100">
                        {copy.collapsePlayerTip}
                      </span>
                    </button>
                  </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowPlayer(true)}
                      className="group relative flex items-center gap-2 rounded-full border border-[#ffd083]/42 bg-[#1f1923]/78 px-4 py-2 text-xs text-[#ffe3bd] shadow-[0_12px_34px_rgba(0,0,0,0.34)] backdrop-blur transition hover:border-[#ffd083]/80"
                    >
                      <span className="h-2 w-2 rounded-full bg-[#ffd083] shadow-[0_0_16px_rgba(255,208,131,0.8)]" />
                      {audioBlocked ? copy.expandControl : isAudioPlaying ? copy.musicPlaying : copy.expandControl}
                      <span className="pointer-events-none absolute bottom-[42px] left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#a77b57]/44 bg-[#1f1923]/92 px-3 py-1.5 text-xs text-[#ffe3bd] opacity-0 shadow-[0_10px_24px_rgba(0,0,0,0.3)] transition group-hover:opacity-100">
                        {copy.expandProgressTip}
                      </span>
                    </button>
                  )}
                </div>
              </>
            )}

          {showOverview && (
            <aside className="absolute bottom-4 left-4 top-4 z-[70] flex w-[330px] flex-col rounded-[18px] border border-[#a77b57]/50 bg-[#211c27]/94 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.52)] backdrop-blur-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-[#ffe3bd]">{copy.overviewTitle}</h2>
                  <p className="mt-2 text-xs leading-relaxed text-[#cdb297]">{copy.overviewText}</p>
                </div>
                <button type="button" onClick={() => setShowOverview(false)} className="text-xl text-[#d7b99b] hover:text-[#ffe3bd]" aria-label={copy.collapse}>×</button>
              </div>
              <div className="mt-4 space-y-2 border-t border-[#8f6b52]/34 pt-4 text-xs text-[#d7b99b]">
                <p className="flex justify-between gap-3"><span>{copy.generatedAt}</span><span>{generatedTime}</span></p>
                <p className="flex justify-between gap-3"><span>{copy.guideCount}</span><span>{characters.length}</span></p>
                <p className="flex justify-between gap-3"><span>{copy.modelStatus}</span><span>{debugInfo?.meta?.model || copy.generated}</span></p>
              </div>
              <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto border-t border-[#8f6b52]/34 pt-4 pr-1 text-xs text-[#d7b99b]">
                {!hasRationale && <p>{copy.noRationale}</p>}
                {userRationale.length > 0 && (
                  <div>
                    <p className="font-semibold text-[#ffe3bd]">{copy.userAnchor}</p>
                    {userRationale.map((mapping) => (
                      <p key={mapping.sourceId} className="mt-2 leading-relaxed text-[#e4c6a4]">
                        {language === "zh"
                          ? conversationUserMessages.find((message) => message.id === mapping.sourceId)?.content || mapping.visualTranslation
                          : mapping.visualTranslation}
                      </p>
                    ))}
                  </div>
                )}
                {briefRationale.length > 0 && (
                  <div className="border-t border-[#8f6b52]/28 pt-3">
                    <p className="font-semibold text-[#ffe3bd]">{copy.coCreationClues}</p>
                    {briefRationale.slice(0, 7).map((mapping) => (
                      <p key={mapping.field} className="mt-2 leading-relaxed">
                        <span className="text-[#efc68e]">{copy.fieldLabels[mapping.field]}</span> · {language === "zh"
                          ? briefFieldText(visualBrief, mapping.field, mapping.visualTranslation)
                          : mapping.visualTranslation}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          )}

          <details
            onToggle={(event) => {
              setShowAppendix(event.currentTarget.open);
              if (event.currentTarget.open) {
                recordExperimentEvent("research-appendix-opened", "/result", {
                  runId: debugInfo?.meta?.runId || null,
                });
              }
            }}
            className={`absolute bottom-1 right-4 z-[70] rounded-[18px] border border-[#a77b57]/44 bg-[#241f2a]/94 p-4 text-sm text-[#ffe3bd] shadow-[0_18px_50px_rgba(0,0,0,0.42)] backdrop-blur-xl transition-[width] ${showAppendix ? "w-[348px] 2xl:w-[404px]" : "w-[170px]"}`}
          >
            <summary className="cursor-pointer font-semibold">{copy.appendix}</summary>
            <div className="mt-4 max-h-[420px] overflow-auto pr-1">
              {debugInfo?.meta?.runId && (
                <div className="rounded-[16px] border border-[#8f6b52]/34 bg-[#2d2732]/78 p-3">
                  <p className="mb-3 text-sm font-semibold">{copy.feedbackTitle}</p>
                  <div className="space-y-3">
                    {[
                      ["musicMatchScore", copy.musicMatch] as const,
                      ["commentMatchScore", copy.commentMatch] as const,
                      ["aestheticScore", copy.aesthetic] as const,
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
                      {FEEDBACK_REASONS[language].map((reason) => {
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
                      placeholder={copy.feedbackPlaceholder}
                      className="h-16 w-full resize-none rounded-[12px] border border-[#8f6b52]/44 bg-[#211b25] p-3 text-xs text-[#ffe3bd] outline-none placeholder:text-[#9f8066] focus:border-[#ffd083]/70"
                    />
                    <button
                      type="button"
                      onClick={submitFeedback}
                      disabled={feedbackStatus === "saving" || feedbackStatus === "saved"}
                      className="w-full rounded-[14px] bg-[#4b3444] py-3 text-sm font-semibold text-[#ffe3bd] transition hover:bg-[#5a3b4d] disabled:opacity-55"
                    >
                      {feedbackStatus === "saving" ? copy.submitting : feedbackStatus === "saved" ? copy.saved : copy.submit}
                    </button>
                    {feedbackStatus === "error" && (
                      <p className="text-center text-xs text-[#ff9f9f]">{copy.feedbackError}</p>
                    )}
                  </div>
                </div>
              )}

              {debugInfo && (
                <details className="mt-3 rounded-[16px] border border-[#8f6b52]/34 bg-[#2d2732]/78 p-3">
                  <summary className="cursor-pointer text-sm font-semibold">{copy.debug}</summary>
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
                      {debugInfo.prompt || copy.notRecorded}
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
          {!showAppendix && (
            <button
              type="button"
              onClick={handleStartOver}
              aria-label={copy.startOver}
              title={copy.startOverTip}
              className="group absolute bottom-5 right-[194px] z-[60] flex h-11 w-11 items-center justify-center rounded-full border border-[#a77b57]/44 bg-[#241f2a]/88 text-[#ffe3bd] shadow-[0_14px_38px_rgba(0,0,0,0.28)] backdrop-blur transition hover:border-[#ffd083]/70 hover:bg-[#302735]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" />
              </svg>
              <span className="sr-only">{copy.startOver}</span>
              <span className="pointer-events-none absolute bottom-[46px] left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#a77b57]/44 bg-[#1f1923]/92 px-3 py-1.5 text-xs text-[#ffe3bd] opacity-0 shadow-[0_10px_24px_rgba(0,0,0,0.3)] transition group-hover:opacity-100">
                {copy.startOverTip}
              </span>
            </button>
          )}
        </section>
      </div>
    </main>
  );
}
