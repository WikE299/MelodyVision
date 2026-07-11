"use client";

import Image from "next/image";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getCharactersByIds, Character } from "@/lib/characters";
import FlowHeader from "@/components/FlowHeader";
import { characterUi, type Language, useHydrated, useLanguage } from "@/lib/i18n";
import { getExperimentSessionId } from "@/lib/experiment-session";
import { recordExperimentEvent } from "@/lib/experiment-events";
import type {
  ConversationMessage,
  ConversationState,
  MusicProfile,
  SourceReference,
  VisualBrief,
  VisualBriefFieldStatus,
} from "@/lib/contracts";
import type { FacilitatorPlan, FacilitatorGoal } from "@/lib/agents/facilitator";
import { readConversationStream } from "@/lib/conversation";

const CRYSTAL_RING_BARS = Array.from({ length: 36 }, (_, index) => 12 + Math.abs(Math.sin(index * 0.62)) * 32);

const FIGURE_STYLE: Record<string, string> = {
  boya: "w-[clamp(178px,12vw,230px)]",
  jikang: "w-[clamp(174px,11.6vw,224px)]",
  caiwenji: "w-[clamp(170px,11.3vw,218px)]",
  abing: "w-[clamp(176px,11.8vw,226px)]",
  tandun: "w-[clamp(166px,11vw,214px)]",
  bach: "w-[clamp(182px,12.2vw,236px)]",
  mozart: "w-[clamp(182px,12.2vw,236px)]",
  beethoven: "w-[clamp(180px,12vw,232px)]",
  armstrong: "w-[clamp(174px,11.6vw,224px)]",
  lennon: "w-[clamp(170px,11.3vw,218px)]",
};

const COPY = {
  zh: {
    listening: "我正在听这段音乐，稍等片刻……",
    failed: "（评论生成失败，请重试）",
    play: "播放音乐",
    pause: "暂停音乐",
    playbackUnavailable: "音频暂时无法播放，请返回首页重新选择音乐",
    progress: "播放进度",
    collapseProgress: "收起播放进度",
    expandProgress: "展开播放进度",
    addFeeling: "点击可补充你的听感",
    myFeeling: "我的感受",
    feelingPlaceholder: "我也想说两句（可选）",
    collapse: "收起",
    sendFeeling: "发送听感",
    sendingFeeling: "正在发送",
    closeComment: "关闭评论",
    resonate: "更接近我的听感",
    resonated: "已作为重点听法",
    guideTip: "点击音乐家听点评，点亮共鸣或补充自己的听感。",
    roomTitle: "共同画面",
    roomSubtitle: "和音乐家一起，把听见的音乐慢慢聊成一幅画",
    facilitator: "共创引导",
    waitingTurn: "先听完这一轮，马上轮到你",
    starterLabel: "可以从这里开始",
    generateHint: "至少说出一处你看见的画面，才会真正成为共同创作",
    goalLabels: {
      "subject-space": "看见什么",
      "motion-composition": "如何运动",
      "light-color-material": "光色触感",
      "meaning-constraints": "留下什么",
    },
    visualForming: "画面正在成形",
    visualReady: "画面线索已聚拢",
    visualLabels: {
      subject: "主体",
      motion: "动势",
      palette: "色彩",
      lighting: "光线",
      atmosphere: "气息",
    },
    sourceUser: "来自你",
    sourceMusic: "来自音乐",
    yourTurn: "轮到你了 · 补充脑海里的画面",
    generate: "生成画作 →",
    generating: "正在把共同听见的画面聚拢成画作",
    generationStages: ["锁定共同画面", "编排视觉提示", "生成并保存画作"],
    generationFailed: "画作生成失败，请稍后重试",
  },
  en: {
    listening: "I am listening closely. One moment...",
    failed: "(Failed to generate this comment. Please try again.)",
    play: "Play music",
    pause: "Pause music",
    playbackUnavailable: "Audio is unavailable. Return home and choose the music again.",
    progress: "Playback progress",
    collapseProgress: "Hide playback progress",
    expandProgress: "Show playback progress",
    addFeeling: "Add your listening note",
    myFeeling: "My note",
    feelingPlaceholder: "I also want to say something (optional)",
    collapse: "Close",
    sendFeeling: "Send listening note",
    sendingFeeling: "Sending",
    closeComment: "Close comment",
    resonate: "Closer to my listening",
    resonated: "Marked as key lens",
    guideTip: "Tap a musician to hear their take, mark resonance, or add your own note.",
    roomTitle: "Shared Image",
    roomSubtitle: "Talk with the musicians and gradually shape the image you hear",
    facilitator: "Co-creation guide",
    waitingTurn: "Listen to this round. Your turn is next.",
    starterLabel: "You could begin here",
    generateHint: "Add at least one image of your own so this becomes a true co-creation.",
    goalLabels: {
      "subject-space": "What appears",
      "motion-composition": "How it moves",
      "light-color-material": "Light and texture",
      "meaning-constraints": "What remains",
    },
    visualForming: "The image is taking shape",
    visualReady: "Visual cues have converged",
    visualLabels: {
      subject: "Subject",
      motion: "Motion",
      palette: "Color",
      lighting: "Light",
      atmosphere: "Air",
    },
    sourceUser: "From you",
    sourceMusic: "From the music",
    yourTurn: "Your turn · add the image in your mind",
    generate: "Generate Artwork →",
    generating: "Gathering what you heard together into an artwork",
    generationStages: ["Locking the shared image", "Composing the visual direction", "Generating and saving"],
    generationFailed: "Artwork generation failed. Please try again.",
  },
};

function getInitialListenState() {
  if (typeof window === "undefined") {
    return {
      selectedChars: [] as Character[],
      audioSrc: "",
      comments: {} as Record<string, string>,
      conversationState: null as ConversationState | null,
      visualBrief: null as VisualBrief | null,
      resonantCharacterIds: [] as string[],
      facilitatorPlan: null as FacilitatorPlan | null,
    };
  }

  const ids = JSON.parse(sessionStorage.getItem("selectedCharacters") || "[]");
  const src = sessionStorage.getItem("audioSrc") || sessionStorage.getItem("audioObjectUrl") || "";
  const comments = JSON.parse(sessionStorage.getItem("comments") || "{}");
  let conversationState: ConversationState | null = null;
  let visualBrief: VisualBrief | null = null;
  let resonantCharacterIds: string[] = [];
  let facilitatorPlan: FacilitatorPlan | null = null;
  try {
    conversationState = JSON.parse(sessionStorage.getItem("conversationState") || "null") as ConversationState | null;
  } catch {
    conversationState = null;
  }
  try {
    visualBrief = JSON.parse(sessionStorage.getItem("visualBrief") || "null") as VisualBrief | null;
  } catch {
    visualBrief = null;
  }
  try {
    resonantCharacterIds = JSON.parse(sessionStorage.getItem("resonantComments") || "[]") as string[];
  } catch {
    resonantCharacterIds = [];
  }
  try {
    facilitatorPlan = JSON.parse(sessionStorage.getItem("facilitatorPlan") || "null") as FacilitatorPlan | null;
  } catch {
    facilitatorPlan = null;
  }
  if (conversationState) {
    for (const message of conversationState.messages) {
      if (message.role === "musician") comments[message.speakerId] = message.content;
    }
  }

  return {
    selectedChars: getCharactersByIds(ids),
    audioSrc: src,
    comments,
    conversationState,
    visualBrief,
    resonantCharacterIds,
    facilitatorPlan,
  };
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "00:00";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

const PALETTE_SWATCHES: Array<[RegExp, string]> = [
  [/黑|black/i, "#24212a"],
  [/白|white/i, "#f3eadc"],
  [/金|gold|amber/i, "#dca75d"],
  [/红|red|crimson/i, "#a74742"],
  [/蓝|blue|cyan/i, "#4f7894"],
  [/绿|green/i, "#58745f"],
  [/紫|purple|violet/i, "#756080"],
  [/灰|gray|grey/i, "#858086"],
  [/棕|brown|earth/i, "#795b49"],
];

function swatchColor(value: string) {
  return PALETTE_SWATCHES.find(([pattern]) => pattern.test(value))?.[1] || "#b58a64";
}

function sourceSummary(
  sources: SourceReference[],
  state: ConversationState | null,
  selectedChars: Character[],
  language: Language
) {
  const copy = COPY[language];
  const names = new Set<string>();
  for (const source of sources) {
    if (source.kind === "user-message") names.add(copy.sourceUser);
    if (source.kind === "music-analysis") names.add(copy.sourceMusic);
    if (source.kind === "musician-message") {
      const message = state?.messages.find((item) => item.id === source.sourceId);
      const character = selectedChars.find((item) => item.id === message?.speakerId);
      if (character) {
        names.add(characterUi[language][character.id as keyof typeof characterUi.zh]?.name || character.name);
      }
    }
  }
  return [...names].join(" + ");
}

function statusTone(status: VisualBriefFieldStatus) {
  if (status === "confirmed") return "text-[#ffe0a3]";
  if (status === "conflicted") return "text-[#efb6a5]";
  return "text-[#d8c0aa]";
}

function VisualBriefTrace({
  brief,
  state,
  selectedChars,
  language,
}: {
  brief: VisualBrief | null;
  state: ConversationState | null;
  selectedChars: Character[];
  language: Language;
}) {
  const copy = COPY[language];
  const candidates = brief ? [
    { key: "subject" as const, field: brief.fields.subject },
    { key: "motion" as const, field: brief.fields.motion },
    { key: "palette" as const, field: brief.fields.palette },
    { key: "lighting" as const, field: brief.fields.lighting },
    { key: "atmosphere" as const, field: brief.fields.atmosphere },
  ].filter(({ field }) => field.status !== "missing" && field.value !== null).slice(0, 2) : [];

  return (
    <div
      className="pointer-events-none absolute left-1/2 top-[58px] z-30 w-[min(240px,20vw)] -translate-x-1/2 translate-y-0 text-center 2xl:top-[72px]"
      aria-live="polite"
    >
      <div className="flex items-center justify-center gap-3 text-[11px] tracking-[0.18em] text-[#d6b38d]/76">
        <span className="h-px w-12 bg-[#d5a15f]/32" />
        <span>{brief?.readiness.ready ? copy.visualReady : copy.visualForming}</span>
        <span className="h-px w-12 bg-[#d5a15f]/32" />
      </div>
      {brief && (
        <div className="mx-auto mt-2 h-px w-full bg-[#8a674e]/28">
          <div
            className="h-px bg-[#efb96f]/78 transition-[width] duration-700"
            style={{ width: `${Math.max(8, brief.readiness.score * 100)}%` }}
          />
        </div>
      )}
      {candidates.length > 0 && (
        <div className="mt-2 flex flex-col divide-y divide-[#9a7354]/28">
          {candidates.map(({ key, field }) => {
            const values = Array.isArray(field.value) ? field.value : [field.value];
            const text = values.filter(Boolean).slice(0, 2).join(" · ");
            const sources = sourceSummary(field.sources, state, selectedChars, language);
            return (
              <div key={key} className="flex min-w-0 items-center justify-center gap-1.5 py-1" title={sources}>
                <span className="shrink-0 text-[10px] tracking-[0.12em] text-[#ad8e75]">{copy.visualLabels[key]}</span>
                <div className={`flex min-w-0 items-center gap-1.5 text-xs font-medium ${statusTone(field.status)}`}>
                  {key === "palette" && values.filter(Boolean).slice(0, 3).map((value) => (
                    <span
                      key={value}
                      className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/20"
                      style={{ backgroundColor: swatchColor(value || "") }}
                    />
                  ))}
                  <span className="truncate">{text}</span>
                </div>
                {sources && <span className="shrink-0 text-[9px] text-[#a98b72]/72">· {sources}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GuideFigure({
  character,
  active,
  commented,
  loading,
  streaming,
  stageOffset,
  onClick,
  language,
}: {
  character: Character;
  active: boolean;
  commented: boolean;
  loading: boolean;
  streaming: boolean;
  stageOffset: string;
  onClick: () => void;
  language: Language;
}) {
  const label = characterUi[language][character.id as keyof typeof characterUi.zh] || {
    name: character.name,
    focus: character.focusDescription,
  };

  return (
    <div
      className={`pointer-events-none group absolute z-40 flex w-[clamp(148px,12vw,192px)] flex-col items-center text-center transition duration-500 ${stageOffset}`}
    >
      {(loading || streaming) && (
        <div className="absolute left-1/2 top-[-24px] z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-[#ffd083]/80 bg-[#ffe0bd]/92 px-3.5 py-2 shadow-[0_0_28px_rgba(255,208,131,0.48)]">
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#5b3e31]"
              style={{ animationDelay: `${dot * 140}ms`, animationDuration: "900ms" }}
            />
          ))}
        </div>
      )}
      <div
        className={`absolute bottom-[40px] h-[clamp(40px,5vw,64px)] w-[clamp(148px,11.5vw,204px)] rounded-[50%] border transition duration-300 ${
          active
            ? "border-[#ffd481] bg-[#ffc267]/28 shadow-[0_0_36px_rgba(255,194,103,0.9),0_22px_38px_rgba(0,0,0,0.45)]"
            : "border-[#b9895d]/46 bg-black/28 shadow-[0_22px_48px_rgba(0,0,0,0.42)] group-hover:border-[#dba35f]/75"
        }`}
      />
      <div className="absolute bottom-[62px] h-[20px] w-[clamp(118px,9vw,168px)] rounded-[50%] bg-[#ffd083]/16 blur-md transition group-hover:bg-[#ffd083]/24" />
      <button
        type="button"
        onClick={onClick}
        className={`pointer-events-auto relative z-10 mb-1 flex h-[clamp(186px,22vh,254px)] items-end justify-center outline-none transition duration-300 ${
          active ? "scale-[1.06] drop-shadow-[0_0_24px_rgba(255,218,145,0.74)]" : "drop-shadow-[0_24px_24px_rgba(0,0,0,0.46)] group-hover:scale-[1.025]"
        }`}
        aria-label={label.name}
      >
        <Image
          src={`/characters/stage/${character.id}.png`}
          alt={label.name}
          width={512}
          height={512}
          priority
          className={`h-auto max-h-[clamp(194px,23vh,266px)] object-contain ${FIGURE_STYLE[character.id] || "w-[clamp(164px,11vw,214px)]"}`}
        />
      </button>
      <div
        className={`pointer-events-none relative z-20 flex items-center gap-2 rounded-full border px-3 py-1.5 text-[#ffe8c9] backdrop-blur transition duration-300 ${
          active
            ? "border-[#ffc976]/80 bg-[#654531]/72 shadow-[0_0_24px_rgba(255,191,94,0.24)]"
            : "border-[#a47b5a]/38 bg-[#2f2832]/58"
        }`}
      >
        <span className={`h-2.5 w-2.5 rounded-full ${loading || active ? "bg-[#ffbd62]" : commented ? "bg-[#8dd28b]" : "bg-[#9b908d]"}`} />
        <p className="text-sm font-semibold">{label.name}</p>
      </div>
    </div>
  );
}

function ConversationEntry({
  role,
  speakerId,
  content,
  streaming,
  selectedChars,
  resonant,
  onToggleResonance,
  language,
}: {
  role: ConversationMessage["role"];
  speakerId: string;
  content: string;
  streaming?: boolean;
  selectedChars: Character[];
  resonant?: boolean;
  onToggleResonance?: () => void;
  language: Language;
}) {
  const copy = COPY[language];
  if (role === "facilitator") {
    return (
      <div className="my-3 flex items-start gap-2 text-[#e4c49d]">
        <span className="mt-2 h-px flex-1 bg-[#9e7657]/35" />
        <p className="max-w-[82%] text-center text-xs leading-relaxed">
          <span className="mr-1 font-semibold text-[#ffd18a]">{copy.facilitator}</span>
          {content}
        </p>
        <span className="mt-2 h-px flex-1 bg-[#9e7657]/35" />
      </div>
    );
  }

  const character = selectedChars.find((item) => item.id === speakerId);
  const label = character
    ? characterUi[language][character.id as keyof typeof characterUi.zh]?.name || character.name
    : language === "zh" ? "我" : "Me";
  const isUser = role === "user";
  return (
    <div className={`mb-3 flex items-end gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && character && (
        <div className="flex h-9 w-9 shrink-0 items-end justify-center overflow-hidden rounded-full border border-[#bd8b5d]/44 bg-[#332a35]">
          <Image src={`/characters/stage/${character.id}.png`} alt="" width={72} height={72} className="h-12 w-12 object-contain object-bottom" />
        </div>
      )}
      <div className={`relative max-w-[82%] rounded-[14px] px-3.5 py-2.5 text-sm leading-relaxed ${
        isUser
          ? "rounded-br-[4px] bg-[#6a4937]/88 text-[#fff0d6]"
          : "rounded-bl-[4px] border border-[#956e52]/34 bg-[#302936]/88 text-[#ead4bc]"
      }`}>
        <p className={`mb-1 text-[11px] font-semibold ${isUser ? "text-[#ffd89d]" : "text-[#dcae78]"}`}>{label}</p>
        <p>{content}{streaming && <span className="ml-1 inline-block h-3.5 w-1 animate-pulse rounded-full bg-[#ffd18a]" />}</p>
        {!isUser && !streaming && onToggleResonance && (
          <button
            type="button"
            onClick={onToggleResonance}
            className={`group absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border transition ${
              resonant ? "border-[#ffd18a]/70 bg-[#6a4937] text-[#ffe7bd]" : "border-[#9b765b]/40 bg-[#241f2a] text-[#bc9877] hover:text-[#ffe0aa]"
            }`}
            aria-label={resonant ? copy.resonated : copy.resonate}
            title={resonant ? copy.resonated : copy.resonate}
          >
            <span className="text-xs">✦</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default function ListenPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const copy = COPY[language];
  const mounted = useHydrated();
  const [initialState] = useState(getInitialListenState);
  const [selectedChars] = useState<Character[]>(initialState.selectedChars);
  const [conversationState, setConversationState] = useState<ConversationState | null>(initialState.conversationState);
  const [visualBrief, setVisualBrief] = useState<VisualBrief | null>(initialState.visualBrief);
  const [facilitatorPlan, setFacilitatorPlan] = useState<FacilitatorPlan | null>(initialState.facilitatorPlan);
  const [allComments, setAllComments] = useState<Record<string, string>>(initialState.comments);
  const [visibleComments, setVisibleComments] = useState<Record<string, string>>(initialState.comments);
  const [revealed, setRevealed] = useState<Set<string>>(new Set(Object.keys(initialState.comments)));
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [streaming, setStreaming] = useState<Set<string>>(new Set());
  const [failedSpeakerId, setFailedSpeakerId] = useState("");
  const [resonantComments, setResonantComments] = useState<Set<string>>(
    new Set(initialState.resonantCharacterIds)
  );
  const [activeCharacterId, setActiveCharacterId] = useState<string>(selectedChars[0]?.id || "");
  const [userNote, setUserNote] = useState("");
  const [submittingUserNote, setSubmittingUserNote] = useState(false);
  const [briefCheckNonce, setBriefCheckNonce] = useState(0);
  const [showPlayerControls, setShowPlayerControls] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationError, setGenerationError] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioError, setAudioError] = useState(initialState.audioSrc ? "" : copy.playbackUnavailable);
  const [audioSrc] = useState(initialState.audioSrc);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const turnInFlightRef = useRef(false);
  const turnAbortRef = useRef<AbortController | null>(null);
  const streamGenerationRef = useRef(0);
  const activeStreamSpeakerRef = useRef("");
  const allCommentsRef = useRef(initialState.comments);
  const visualBriefRefRef = useRef(initialState.conversationState?.visualBriefRef || null);
  const briefInFlightRef = useRef(false);
  const failedBriefVersionRef = useRef(0);

  useEffect(() => {
    if (selectedChars.length === 0 || !conversationState) {
      router.push("/select");
    }
  }, [conversationState, router, selectedChars.length]);

  useEffect(() => {
    const container = chatScrollRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [conversationState?.messages.length, streaming, visibleComments]);

  useEffect(() => () => {
    streamGenerationRef.current += 1;
    turnAbortRef.current?.abort();
    turnAbortRef.current = null;
    turnInFlightRef.current = false;
    activeStreamSpeakerRef.current = "";
  }, []);

  useEffect(() => {
    if (!generating) return;
    const timerId = window.setInterval(() => {
      setGenerationProgress((current) => {
        if (current < 35) return Math.min(35, current + 3);
        if (current < 72) return Math.min(72, current + 2);
        return Math.min(92, current + 1);
      });
    }, 700);
    return () => window.clearInterval(timerId);
  }, [generating]);

  const togglePlay = async () => {
    if (!audioRef.current) {
      setAudioError(copy.playbackUnavailable);
      return;
    }
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        await audioRef.current.play();
        setAudioError("");
        setIsPlaying(true);
      } catch (error) {
        console.warn("Listening-room audio playback failed:", error);
        setAudioError(copy.playbackUnavailable);
        setIsPlaying(false);
      }
    }
  };

  const handleSeek = (value: string) => {
    const nextTime = Number(value);
    if (!audioRef.current || Number.isNaN(nextTime)) return;
    audioRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const persistConversationState = useCallback((nextState: ConversationState) => {
    const latestRef = visualBriefRefRef.current;
    const mergedState = latestRef && (nextState.visualBriefRef?.version || 0) < latestRef.version
      ? { ...nextState, visualBriefRef: latestRef }
      : nextState;
    visualBriefRefRef.current = mergedState.visualBriefRef;
    setConversationState(mergedState);
    sessionStorage.setItem("conversationState", JSON.stringify(mergedState));
  }, []);

  const mergeVisualBriefRef = useCallback((visualBriefRef: ConversationState["visualBriefRef"]) => {
    if (visualBriefRef) visualBriefRefRef.current = visualBriefRef;
    setConversationState((current) => {
      if (!current || !visualBriefRef) return current;
      if ((current.visualBriefRef?.version || 0) >= visualBriefRef.version) return current;
      const next = { ...current, visualBriefRef };
      sessionStorage.setItem("conversationState", JSON.stringify(next));
      return next;
    });
  }, []);

  const clearTurnIndicators = useCallback((speakerId: string) => {
    setLoading((prev) => {
      const next = new Set(prev);
      next.delete(speakerId);
      return next;
    });
    setStreaming((prev) => {
      const next = new Set(prev);
      next.delete(speakerId);
      return next;
    });
  }, []);

  const runScheduledTurn = useCallback(async (state: ConversationState) => {
    const speakerId = state.queuedSpeakerIds[0];
    if (!speakerId || turnInFlightRef.current) return;

    turnInFlightRef.current = true;
    const requestGeneration = ++streamGenerationRef.current;
    const controller = new AbortController();
    turnAbortRef.current = controller;
    activeStreamSpeakerRef.current = speakerId;
    setFailedSpeakerId("");
    setActiveCharacterId(speakerId);
    setRevealed((prev) => new Set(prev).add(speakerId));
    setVisibleComments((prev) => ({ ...prev, [speakerId]: "" }));
    setLoading((prev) => new Set(prev).add(speakerId));
    setStreaming((prev) => new Set(prev).add(speakerId));

    try {
      const musicAnalysis = JSON.parse(sessionStorage.getItem("musicAnalysis") || "{}");
      const response = await fetch("/api/conversation/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationState: state, musicAnalysis }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) throw new Error("Conversation stream failed");

      let streamError = "";
      let completed = false;
      await readConversationStream(response.body, (event) => {
        if (requestGeneration !== streamGenerationRef.current) return;
        if (event.type === "delta") {
          setLoading((prev) => {
            const next = new Set(prev);
            next.delete(speakerId);
            return next;
          });
          setVisibleComments((prev) => ({
            ...prev,
            [speakerId]: `${prev[speakerId] || ""}${event.delta}`,
          }));
        } else if (event.type === "complete") {
          completed = true;
          setVisibleComments((prev) => ({ ...prev, [speakerId]: event.comment }));
          setAllComments((prev) => {
            const next = { ...prev, [speakerId]: event.comment };
            allCommentsRef.current = next;
            sessionStorage.setItem("comments", JSON.stringify(next));
            return next;
          });
          activeStreamSpeakerRef.current = "";
          persistConversationState(event.state);
        } else if (event.type === "error") {
          streamError = event.message;
        }
      });
      if (streamError || !completed) throw new Error(streamError || "Conversation stream ended early");
    } catch (error) {
      if (!controller.signal.aborted && requestGeneration === streamGenerationRef.current) {
        console.error(error);
        setFailedSpeakerId(speakerId);
        setVisibleComments((prev) => ({ ...prev, [speakerId]: copy.failed }));
      }
    } finally {
      if (requestGeneration === streamGenerationRef.current) {
        clearTurnIndicators(speakerId);
        turnInFlightRef.current = false;
        turnAbortRef.current = null;
        activeStreamSpeakerRef.current = "";
      }
    }
  }, [clearTurnIndicators, copy.failed, persistConversationState]);

  useEffect(() => {
    const nextSpeakerId = conversationState?.queuedSpeakerIds[0];
    if (
      conversationState?.status === "streaming-musician" &&
      nextSpeakerId &&
      failedSpeakerId !== nextSpeakerId
    ) {
      void runScheduledTurn(conversationState);
    }
  }, [conversationState, failedSpeakerId, runScheduledTurn]);

  const updateVisualBrief = useCallback(async (
    state: ConversationState,
    expectedVersion: number
  ) => {
    if (briefInFlightRef.current) return;
    briefInFlightRef.current = true;
    try {
      const musicAnalysis = JSON.parse(sessionStorage.getItem("musicAnalysis") || "{}");
      const previousBrief = JSON.parse(sessionStorage.getItem("visualBrief") || "null");
      const response = await fetch("/api/conversation/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationState: state,
          previousBrief,
          musicAnalysis,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "VisualBrief update failed");
      const nextBrief = data.visualBrief as VisualBrief;
      setVisualBrief(nextBrief);
      sessionStorage.setItem("visualBrief", JSON.stringify(nextBrief));
      sessionStorage.setItem("visualBriefMeta", JSON.stringify(data.meta));
      mergeVisualBriefRef(data.visualBriefRef);
      failedBriefVersionRef.current = 0;
    } catch (error) {
      console.error(error);
      failedBriefVersionRef.current = expectedVersion;
    } finally {
      briefInFlightRef.current = false;
      setBriefCheckNonce((value) => value + 1);
    }
  }, [mergeVisualBriefRef]);

  useEffect(() => {
    if (!conversationState || conversationState.turnOwner !== "user") return;
    const completedRounds = conversationState.messages.reduce((count, message, index, messages) => {
      return message.role === "facilitator" && messages[index - 1]?.role === "musician"
        ? count + 1
        : count;
    }, 0);
    const currentVersion = conversationState.visualBriefRef?.version || visualBrief?.version || 0;
    if (
      completedRounds > currentVersion &&
      failedBriefVersionRef.current !== completedRounds
    ) {
      void updateVisualBrief(conversationState, completedRounds);
    }
  }, [briefCheckNonce, conversationState, updateVisualBrief, visualBrief?.version]);

  const handleReveal = (charId: string) => {
    setActiveCharacterId(charId);
    if (failedSpeakerId === charId && conversationState) {
      setFailedSpeakerId("");
      void runScheduledTurn(conversationState);
      return;
    }
    if (allComments[charId]) setRevealed((prev) => new Set(prev).add(charId));
  };

  const cancelActiveTurn = useCallback(() => {
    const speakerId = activeStreamSpeakerRef.current;
    streamGenerationRef.current += 1;
    turnAbortRef.current?.abort();
    turnAbortRef.current = null;
    turnInFlightRef.current = false;
    activeStreamSpeakerRef.current = "";
    setLoading(new Set());
    setStreaming(new Set());
    if (speakerId) {
      setVisibleComments((prev) => {
        const next = { ...prev };
        const committed = allCommentsRef.current[speakerId];
        if (committed) next[speakerId] = committed;
        else delete next[speakerId];
        return next;
      });
      if (!allCommentsRef.current[speakerId]) {
        setRevealed((prev) => {
          const next = new Set(prev);
          next.delete(speakerId);
          return next;
        });
      }
    }
  }, []);

  const handleSubmitUserNote = async () => {
    const content = userNote.trim();
    if (!content || !conversationState || submittingUserNote) return;

    setSubmittingUserNote(true);
    cancelActiveTurn();
    try {
      const response = await fetch("/api/conversation/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationState, content, visualBrief }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Conversation response failed");
      persistConversationState(data.state as ConversationState);
      recordExperimentEvent("user-message-submitted", "/listen", {
        conversationId: conversationState.id,
        characterCount: content.length,
      });
      if (data.facilitatorPlan) {
        setFacilitatorPlan(data.facilitatorPlan as FacilitatorPlan);
        sessionStorage.setItem("facilitatorPlan", JSON.stringify(data.facilitatorPlan));
      }
      setUserNote("");
      setFailedSpeakerId("");
    } catch (error) {
      console.error(error);
    } finally {
      setSubmittingUserNote(false);
    }
  };

  const toggleResonance = (charId: string) => {
    setResonantComments((prev) => {
      const next = new Set(prev);
      const selected = !next.has(charId);
      if (next.has(charId)) {
        next.delete(charId);
      } else {
        next.add(charId);
      }
      sessionStorage.setItem("resonantComments", JSON.stringify([...next]));
      recordExperimentEvent("resonance-toggled", "/listen", {
        musicianId: charId,
        selected,
      });
      return next;
    });
  };

  const waitForBackgroundBrief = async () => {
    for (let attempt = 0; attempt < 150 && briefInFlightRef.current; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 400));
    }
    if (briefInFlightRef.current) throw new Error("VisualBrief update timed out");
  };

  const resolveGenerationBrief = async (state: ConversationState) => {
    await waitForBackgroundBrief();
    let latestState = JSON.parse(sessionStorage.getItem("conversationState") || "null") as ConversationState | null;
    if (!latestState || latestState.id !== state.id) latestState = state;
    let latestBrief = JSON.parse(sessionStorage.getItem("visualBrief") || "null") as VisualBrief | null;
    const briefMatches = Boolean(
      latestBrief &&
      latestState.visualBriefRef?.id === latestBrief.id &&
      latestState.visualBriefRef.version === latestBrief.version
    );
    if (briefMatches) return { state: latestState, brief: latestBrief! };

    const musicAnalysis = JSON.parse(sessionStorage.getItem("musicAnalysis") || "{}");
    const response = await fetch("/api/conversation/brief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationState: latestState,
        previousBrief: latestBrief,
        musicAnalysis,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "VisualBrief update failed");
    latestBrief = data.visualBrief as VisualBrief;
    const nextState = {
      ...latestState,
      visualBriefRef: data.visualBriefRef,
    };
    persistConversationState(nextState);
    setVisualBrief(latestBrief);
    sessionStorage.setItem("visualBrief", JSON.stringify(latestBrief));
    sessionStorage.setItem("visualBriefMeta", JSON.stringify(data.meta));
    return { state: nextState, brief: latestBrief };
  };

  const handleContinue = async () => {
    if (!conversationState || generating) return;
    cancelActiveTurn();
    setGenerating(true);
    setGenerationProgress(6);
    setGenerationError("");
    recordExperimentEvent("generation-started", "/listen", {
      conversationId: conversationState.id,
      musicianCount: conversationState.selectedMusicianIds.length,
      resonantMusicianIds: [...resonantComments],
    });

    try {
      const stateResponse = await fetch("/api/conversation/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationState }),
      });
      const stateData = await stateResponse.json();
      if (!stateResponse.ok) throw new Error(stateData.error || "Conversation cannot enter generation");
      const readyState = stateData.state as ConversationState;
      persistConversationState(readyState);
      setGenerationProgress(18);

      const generationContext = await resolveGenerationBrief(readyState);
      setGenerationProgress(34);
      const comments = allCommentsRef.current;
      const commentWeights = Object.fromEntries(
        Object.keys(comments).map((characterId) => [
          characterId,
          {
            resonance: resonantComments.has(characterId),
            weight: resonantComments.has(characterId) ? 1.8 : 1,
          },
        ])
      );
      const commentList = generationContext.state.selectedMusicianIds
        .filter((characterId) => comments[characterId])
        .map((characterId) => ({
          characterId,
          text: comments[characterId],
          weight: commentWeights[characterId]?.weight || 1,
          userResonance: Boolean(commentWeights[characterId]?.resonance),
        }));
      const userMessages = generationContext.state.messages
        .filter((message) => message.role === "user")
        .map((message) => message.content)
        .join("\n") || userNote;
      const musicAnalysis = JSON.parse(sessionStorage.getItem("musicAnalysis") || "{}");
      const musicProfile = JSON.parse(sessionStorage.getItem("musicProfile") || "null") as MusicProfile | null;
      const sessionId = await getExperimentSessionId();
      const presets = { style: "自动", mood: "自动", tone: "自动" };

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          selectedCharacters: generationContext.state.selectedMusicianIds,
          comments: commentList,
          commentWeights,
          presets,
          userNote: userMessages,
          musicAnalysis,
          musicProfile,
          conversationState: generationContext.state,
          visualBrief: generationContext.brief,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.imageUrl) {
        throw new Error(data.detail || data.error || copy.generationFailed);
      }

      sessionStorage.setItem("comments", JSON.stringify(comments));
      sessionStorage.setItem("commentWeights", JSON.stringify(commentWeights));
      sessionStorage.setItem("userNote", userMessages);
      sessionStorage.setItem("imagePresets", JSON.stringify(presets));
      sessionStorage.setItem("generatedImageUrl", data.imageUrl);
      sessionStorage.setItem("generatedRemoteImageUrl", data.remoteImageUrl || "");
      sessionStorage.setItem("generatedImagePrompt", data.prompt || "");
      sessionStorage.setItem("generatedNegativePrompt", data.negativePrompt || "");
      sessionStorage.setItem("experimentSessionId", data.sessionId || sessionId);
      sessionStorage.setItem(
        "imageGenerationMeta",
        JSON.stringify({
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
        })
      );
      setGenerationProgress(100);
      router.push("/result");
    } catch (error) {
      console.error(error);
      setGenerationError(error instanceof Error ? error.message : copy.generationFailed);
      setGenerating(false);
      setGenerationProgress(0);
    }
  };

  const stageSlotsByCount: Record<number, string[]> = {
    1: ["left-[22%] bottom-[58px] -translate-x-1/2"],
    2: [
      "left-[20%] bottom-[58px] -translate-x-1/2",
      "right-[20%] bottom-[58px] translate-x-1/2",
    ],
    3: [
      "left-[11%] bottom-[28px] -translate-x-1/2",
      "left-[29%] bottom-[170px] -translate-x-1/2",
      "right-[11%] bottom-[28px] translate-x-1/2",
    ],
    4: [
      "left-[11%] bottom-[22px] -translate-x-1/2",
      "left-[31%] bottom-[176px] -translate-x-1/2",
      "right-[31%] bottom-[176px] translate-x-1/2",
      "right-[11%] bottom-[22px] translate-x-1/2",
    ],
  };
  const stageSlots = stageSlotsByCount[Math.min(selectedChars.length, 4)] || stageSlotsByCount[4];
  const conversationMessages = conversationState?.messages || [];
  const latestMessage = conversationMessages.at(-1);
  const timelineMessages = latestMessage?.role === "facilitator" &&
    latestMessage.content === facilitatorPlan?.userInvitation
    ? conversationMessages.slice(0, -1)
    : conversationMessages;
  const generationStageIndex = Math.min(
    copy.generationStages.length - 1,
    Math.floor((Math.max(generationProgress, 1) / 100) * copy.generationStages.length)
  );

  if (!mounted) return null;

  return (
    <main className="relative h-screen overflow-hidden bg-[#15111c] text-[#f8dfbb]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,178,91,0.18),transparent_28%),radial-gradient(circle_at_50%_82%,rgba(255,183,92,0.14),transparent_34%),linear-gradient(135deg,#111420_0%,#2b2533_45%,#10121d_100%)]" />
      <div className="absolute inset-0 opacity-32 [background-image:linear-gradient(115deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(25deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:180px_180px,220px_220px]" />

      <div className="relative z-10 flex h-screen flex-col px-4 py-3 lg:px-6 lg:py-4 2xl:px-14 2xl:py-6">
        <FlowHeader activeStep={3} />

        <section className="relative mt-3 grid min-h-0 flex-1 overflow-hidden rounded-[22px] border border-[#9f6f45]/55 bg-[#251f2b]/42 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] lg:grid-cols-[minmax(0,1fr)_minmax(360px,32vw)] 2xl:mt-5 2xl:grid-cols-[minmax(0,1fr)_430px]">
          <div className="relative min-h-0 overflow-hidden">
            {audioSrc && (
              <audio
                ref={audioRef}
                src={audioSrc}
                preload="auto"
                loop
                onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
                onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime || 0)}
                onPlay={() => {
                  setAudioError("");
                  setIsPlaying(true);
                }}
                onPause={() => setIsPlaying(false)}
                onError={() => setAudioError(copy.playbackUnavailable)}
              />
            )}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_56%,rgba(255,178,91,0.17),transparent_30%),linear-gradient(145deg,rgba(17,20,32,0.34),rgba(43,37,51,0.5))]" />
            <div className="pointer-events-none absolute left-[-8%] right-[-8%] top-[22%] flex h-28 items-end justify-center gap-1 opacity-52">
              {Array.from({ length: 120 }).map((_, index) => (
                <span
                  key={index}
                  className="w-1 rounded-full bg-[#d99b4d]"
                  style={{
                    height: `${(6 + Math.abs(Math.sin(index * 0.17)) * 68).toFixed(2)}px`,
                    opacity: (0.18 + Math.abs(Math.sin(index * 0.23)) * 0.42).toFixed(3),
                  }}
                />
              ))}
            </div>
            <div className="pointer-events-none absolute bottom-[-126px] left-1/2 h-[430px] w-[1120px] -translate-x-1/2 rounded-[50%] border border-[#d09a62]/30 bg-[#6f5949]/18 shadow-[0_30px_120px_rgba(0,0,0,0.52),inset_0_18px_52px_rgba(255,186,98,0.07)]" />
            <div className="pointer-events-none absolute bottom-[-68px] left-1/2 h-[310px] w-[850px] -translate-x-1/2 rounded-[50%] border border-[#bd8756]/24" />

            {!showPlayerControls && (
              <VisualBriefTrace
                brief={visualBrief}
                state={conversationState}
                selectedChars={selectedChars}
                language={language}
              />
            )}

            {showPlayerControls && (
              <div className="absolute left-1/2 top-5 z-[70] flex h-[52px] w-[min(410px,58%)] -translate-x-1/2 items-center gap-3 rounded-full border border-[#ca8f53]/62 bg-[#1e1923]/92 px-3 shadow-[0_18px_48px_rgba(0,0,0,0.34)] backdrop-blur">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ffe2bd] text-sm font-semibold text-[#382832]"
                  aria-label={isPlaying ? copy.pause : copy.play}
                >
                  {isPlaying ? "Ⅱ" : "▶"}
                </button>
                <div className="relative flex min-w-0 flex-1 items-center">
                  <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center gap-[3px]">
                    {Array.from({ length: 34 }).map((_, index) => (
                      <span
                        key={index}
                        className="w-[3px] rounded-full bg-[#e5a45b]"
                        style={{
                          height: `${(6 + Math.abs(Math.sin(index * 0.58)) * 22).toFixed(1)}px`,
                          opacity: index / 34 <= (duration ? currentTime / duration : 0) ? 0.96 : 0.24,
                        }}
                      />
                    ))}
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={duration || currentTime || 1}
                    step={0.1}
                    value={Math.min(currentTime, duration || currentTime)}
                    onChange={(event) => handleSeek(event.target.value)}
                    className="relative z-10 h-9 w-full cursor-pointer appearance-none bg-transparent opacity-0"
                    aria-label={copy.progress}
                  />
                </div>
                <span className="shrink-0 text-[10px] font-medium text-[#ffe0bd]">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>
            )}

            <div className="absolute inset-x-0 bottom-0 top-[74px]">
              {selectedChars.map((character, index) => (
                <GuideFigure
                  key={character.id}
                  character={character}
                  active={character.id === activeCharacterId}
                  commented={revealed.has(character.id)}
                  loading={loading.has(character.id)}
                  streaming={streaming.has(character.id)}
                  stageOffset={stageSlots[index] || stageSlots[stageSlots.length - 1]}
                  onClick={() => handleReveal(character.id)}
                  language={language}
                />
              ))}

              <div className="absolute bottom-[78px] left-1/2 z-30 h-[clamp(238px,19vw,300px)] w-[clamp(238px,19vw,300px)] -translate-x-1/2">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="group/crystal absolute inset-0 flex cursor-pointer items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#ffd083]"
                  aria-label={isPlaying ? copy.pause : copy.play}
                >
                  <div className={`absolute inset-3 rounded-full bg-[#ffc267]/18 blur-2xl transition duration-500 ${isPlaying ? "scale-125 opacity-100" : "scale-95 opacity-45 group-hover/crystal:scale-110 group-hover/crystal:opacity-85"}`} />
                  <div className={`absolute inset-0 rounded-full border border-[#ffd98b]/32 transition duration-500 ${isPlaying ? "scale-110 opacity-80 shadow-[0_0_54px_rgba(255,196,99,0.48)]" : "scale-95 opacity-35 group-hover/crystal:scale-105 group-hover/crystal:opacity-70"}`} />
                  {CRYSTAL_RING_BARS.map((height, index) => (
                    <span
                      key={index}
                      className="pointer-events-none absolute left-1/2 top-1/2 w-1 origin-bottom rounded-full bg-[#ffc267]"
                      style={{
                        height: `${isPlaying ? height : height * 0.42}px`,
                        opacity: isPlaying ? 0.34 + Math.abs(Math.sin(index * 0.71)) * 0.48 : 0.13,
                        transform: `translate(-50%, -50%) rotate(${index * 10}deg) translateY(-${isPlaying ? 122 : 100}px)`,
                        transition: "height 360ms ease, opacity 360ms ease, transform 360ms ease",
                      }}
                    />
                  ))}
                  <div className="pointer-events-none absolute bottom-[15%] h-[72px] w-[200px] rounded-[50%] border border-[#f3bb75]/42 bg-[#72533f]/42 shadow-[0_18px_66px_rgba(0,0,0,0.46),0_0_34px_rgba(255,195,97,0.16)]" />
                  <Image
                    src="/stage-gem-transparent.webp"
                    alt=""
                    width={1254}
                    height={1254}
                    priority
                    unoptimized
                    className={`pointer-events-none relative z-10 h-auto w-[clamp(168px,13vw,220px)] opacity-95 transition duration-500 ${isPlaying ? "scale-[1.05] brightness-110 drop-shadow-[0_0_42px_rgba(255,205,116,0.62)]" : "drop-shadow-[0_0_24px_rgba(255,195,97,0.34)] group-hover/crystal:scale-[1.03] group-hover/crystal:brightness-110"}`}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => setShowPlayerControls((prev) => !prev)}
                  className="absolute bottom-[-14px] left-1/2 z-40 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-[#c9965d]/46 bg-[#1f1a24]/90 text-[#ffe3bd]"
                  aria-label={showPlayerControls ? copy.collapseProgress : copy.expandProgress}
                >
                  {showPlayerControls ? "⌄" : "⌃"}
                </button>
              </div>
            </div>

            {audioError && (
              <p className="absolute bottom-5 left-1/2 z-[75] w-[min(520px,82%)] -translate-x-1/2 text-center text-xs text-[#efb6a5]">
                {audioError}
              </p>
            )}
          </div>

          <aside className="relative z-[90] flex min-h-0 flex-col border-l border-[#9f6f45]/42 bg-[#1d1923]/88 backdrop-blur">
            <header className="shrink-0 border-b border-[#9f6f45]/30 px-5 pb-3 pt-4">
              <p className="font-serif text-xl font-semibold text-[#ffe3bd]">{copy.roomTitle}</p>
              <p className="mt-1 text-xs leading-relaxed text-[#c9aa8c]">{copy.roomSubtitle}</p>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {(Object.keys(copy.goalLabels) as FacilitatorGoal[]).map((goal, index) => {
                  const activeGoal = facilitatorPlan?.currentGoal || "subject-space";
                  const activeIndex = (Object.keys(copy.goalLabels) as FacilitatorGoal[]).indexOf(activeGoal);
                  return (
                    <div key={goal} className="min-w-0">
                      <div className={`h-0.5 w-full ${index <= activeIndex ? "bg-[#efb96f]" : "bg-[#715744]/48"}`} />
                      <p className={`mt-1 truncate text-[10px] ${index === activeIndex ? "text-[#ffd18a]" : "text-[#9f8874]"}`}>
                        {copy.goalLabels[goal]}
                      </p>
                    </div>
                  );
                })}
              </div>
            </header>

            <div ref={chatScrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {timelineMessages.map((message) => (
                <ConversationEntry
                  key={message.id}
                  role={message.role}
                  speakerId={message.speakerId}
                  content={message.content}
                  selectedChars={selectedChars}
                  resonant={resonantComments.has(message.speakerId)}
                  onToggleResonance={message.role === "musician" ? () => toggleResonance(message.speakerId) : undefined}
                  language={language}
                />
              ))}
              {[...streaming].map((speakerId) => (
                <ConversationEntry
                  key={`streaming-${speakerId}`}
                  role="musician"
                  speakerId={speakerId}
                  content={visibleComments[speakerId] || copy.listening}
                  streaming
                  selectedChars={selectedChars}
                  language={language}
                />
              ))}
            </div>

            <div className="shrink-0 border-t border-[#9f6f45]/32 bg-[#211c26]/96 px-4 py-3">
              {facilitatorPlan?.userInvitation && (
                <p className="mb-2 border-l-2 border-[#e4ad68] pl-3 text-xs font-medium leading-relaxed text-[#f1d2ad]">
                  {facilitatorPlan.userInvitation}
                </p>
              )}
              {facilitatorPlan?.sentenceStarters?.length ? (
                <div className="mb-2">
                  <p className="mb-1.5 text-[10px] font-semibold tracking-[0.12em] text-[#b89574]">{copy.starterLabel}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {facilitatorPlan.sentenceStarters.map((starter) => (
                      <button
                        key={starter}
                        type="button"
                        onClick={() => setUserNote(starter)}
                        className="border-b border-[#9f7655]/45 py-0.5 text-left text-[11px] text-[#dfc3a6] transition hover:border-[#ffd18a] hover:text-[#ffe3bd]"
                      >
                        {starter}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className={`flex items-end gap-2 border-b px-1 pb-2 transition ${conversationState?.turnOwner === "user" ? "border-[#e4ad68]" : "border-[#8c6a50]/55"}`}>
                <textarea
                  value={userNote}
                  onChange={(event) => setUserNote(event.target.value)}
                  placeholder={conversationState?.turnOwner === "user" ? copy.feelingPlaceholder : copy.waitingTurn}
                  rows={2}
                  className="min-h-[46px] min-w-0 flex-1 resize-none bg-transparent text-sm leading-relaxed text-[#ffe3bd] outline-none placeholder:text-[#927c69]"
                />
                <button
                  type="button"
                  onClick={handleSubmitUserNote}
                  disabled={!userNote.trim() || submittingUserNote}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f4d09a] text-base font-semibold text-[#342831] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-35"
                  aria-label={submittingUserNote ? copy.sendingFeeling : copy.sendFeeling}
                >
                  ↑
                </button>
              </div>
              {generationError && <p className="mt-2 text-xs text-[#efb6a5]">{generationError}</p>}
              {!conversationState?.messages.some((message) => message.role === "user") && (
                <p className="mt-2 text-[10px] leading-relaxed text-[#a88e77]">{copy.generateHint}</p>
              )}
              <button
                type="button"
                onClick={handleContinue}
                disabled={
                  Object.keys(allComments).length === 0 ||
                  !conversationState?.messages.some((message) => message.role === "user") ||
                  generating
                }
                className="mt-2 flex h-12 w-full items-center justify-center border border-[#f4bd72]/58 bg-[#4b3540]/88 px-5 text-sm font-semibold text-[#ffe3bd] shadow-[0_12px_34px_rgba(0,0,0,0.26)] transition hover:bg-[#5a3b49] disabled:cursor-not-allowed disabled:border-[#735844]/35 disabled:bg-[#2a242d] disabled:text-[#806f61]"
              >
                {copy.generate}
              </button>
            </div>
          </aside>

          {generating && (
            <div className="absolute inset-0 z-[120] flex items-center justify-center bg-[#15111c]/90 backdrop-blur-sm">
              <div className="w-[min(520px,72vw)] text-center">
                <div className="mx-auto h-16 w-16 animate-spin rounded-full border border-[#a97950]/42 border-t-[#ffd083]" />
                <p className="mt-7 font-serif text-[clamp(20px,2vw,30px)] font-semibold text-[#ffe3bd]">{copy.generating}</p>
                <p className="mt-3 text-sm text-[#d5b895]">{copy.generationStages[generationStageIndex]}</p>
                <div className="mt-6 h-1 overflow-hidden bg-[#7f614a]/34">
                  <div className="h-full bg-[#efb96f] transition-[width] duration-500" style={{ width: `${generationProgress}%` }} />
                </div>
                <p className="mt-2 text-xs tabular-nums text-[#b99b80]">{generationProgress}%</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
