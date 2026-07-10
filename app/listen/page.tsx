"use client";

import Image from "next/image";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getCharactersByIds, Character } from "@/lib/characters";
import FlowHeader from "@/components/FlowHeader";
import { characterUi, type Language, useHydrated, useLanguage } from "@/lib/i18n";

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
    progress: "播放进度",
    collapseProgress: "收起播放进度",
    expandProgress: "展开播放进度",
    addFeeling: "点击可补充你的听感",
    myFeeling: "我的感受",
    feelingPlaceholder: "我也想说两句（可选）",
    collapse: "收起",
    closeComment: "关闭评论",
    resonate: "更接近我的听感",
    resonated: "已作为重点听法",
    guideTip: "点击音乐家听点评，点亮共鸣或补充自己的听感。",
    generate: "生成画作 →",
  },
  en: {
    listening: "I am listening closely. One moment...",
    failed: "(Failed to generate this comment. Please try again.)",
    play: "Play music",
    pause: "Pause music",
    progress: "Playback progress",
    collapseProgress: "Hide playback progress",
    expandProgress: "Show playback progress",
    addFeeling: "Add your listening note",
    myFeeling: "My note",
    feelingPlaceholder: "I also want to say something (optional)",
    collapse: "Close",
    closeComment: "Close comment",
    resonate: "Closer to my listening",
    resonated: "Marked as key lens",
    guideTip: "Tap a musician to hear their take, mark resonance, or add your own note.",
    generate: "Generate Artwork →",
  },
};

function getInitialListenState() {
  if (typeof window === "undefined") {
    return {
      selectedChars: [] as Character[],
      audioSrc: "",
      comments: {} as Record<string, string>,
    };
  }

  const ids = JSON.parse(sessionStorage.getItem("selectedCharacters") || "[]");
  const src = sessionStorage.getItem("audioSrc") || sessionStorage.getItem("audioObjectUrl") || "";
  const comments = JSON.parse(sessionStorage.getItem("comments") || "{}");

  return {
    selectedChars: getCharactersByIds(ids),
    audioSrc: src,
    comments,
  };
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "00:00";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function GuideFigure({
  character,
  active,
  commented,
  loading,
  streaming,
  comment,
  resonant,
  stageOffset,
  onClick,
  onClose,
  onToggleResonance,
  language,
}: {
  character: Character;
  active: boolean;
  commented: boolean;
  loading: boolean;
  streaming: boolean;
  comment: string;
  resonant: boolean;
  stageOffset: string;
  onClick: () => void;
  onClose: () => void;
  onToggleResonance: () => void;
  language: Language;
}) {
  const copy = COPY[language];
  const label = characterUi[language][character.id as keyof typeof characterUi.zh] || {
    name: character.name,
    focus: character.focusDescription,
  };

  return (
    <div
      onClick={onClick}
      className={`group absolute flex w-[clamp(178px,14vw,230px)] flex-col items-center pt-[clamp(104px,12vh,132px)] text-center transition duration-500 ${
        loading || commented ? "z-[70]" : "z-40"
      } ${loading ? "cursor-wait" : "cursor-pointer"} ${stageOffset}`}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
    >
      {(loading || commented) && (
        <div className="absolute left-1/2 top-[-6px] z-50 w-[clamp(248px,18vw,330px)] -translate-x-1/2 rounded-[18px] border border-[#f5c184]/80 bg-[#ffe0bd]/96 px-4 py-3 text-left text-[#322534] shadow-[0_18px_42px_rgba(0,0,0,0.3)]">
          <div className="flex items-center gap-2 pr-16">
            <p className="text-sm font-semibold">{label.name}</p>
          </div>
          {commented && !loading && (
            <>
              <div className="group/resonance absolute right-10 top-2.5">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleResonance();
                  }}
                  className={`flex h-6 w-6 items-center justify-center rounded-full border transition ${
                    resonant
                      ? "border-[#8b5e2f]/62 bg-[#5b3e31] text-[#ffe6c3] shadow-[0_0_18px_rgba(91,62,49,0.38),0_0_24px_rgba(255,208,131,0.22)]"
                      : "border-[#d59a5f]/45 bg-[#fff0d7]/70 text-[#8a6042] shadow-[0_0_14px_rgba(255,208,131,0.22)] hover:border-[#a97745]/70 hover:bg-white hover:text-[#5b3e31]"
                  }`}
                  aria-label={resonant ? copy.resonated : copy.resonate}
                  aria-pressed={resonant}
                >
                  <svg className="h-3.5 w-3.5" fill={resonant ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3.5l1.9 5.2 5.2 1.9-5.2 1.9-1.9 5.2-1.9-5.2-5.2-1.9 5.2-1.9L12 3.5z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M18.5 3.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z" />
                  </svg>
                </button>
                <span className="pointer-events-none absolute right-1/2 top-[-34px] z-20 translate-x-1/2 whitespace-nowrap rounded-full border border-[#8b5e2f]/22 bg-[#2f2430]/94 px-3 py-1 text-[11px] font-semibold text-[#ffe6c3] opacity-0 shadow-[0_12px_28px_rgba(0,0,0,0.22)] transition duration-150 group-hover/resonance:opacity-100">
                  {resonant ? copy.resonated : copy.resonate}
                </span>
              </div>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onClose();
                }}
                className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full border border-[#9a7458]/35 bg-[#fff0d7]/70 text-[#5b3e31] transition hover:border-[#7d573f]/60 hover:bg-white"
                aria-label={copy.closeComment}
                title={copy.closeComment}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </>
          )}
          <p className="mt-2 max-h-[9.6em] overflow-y-auto pr-1 text-sm font-medium leading-relaxed">
            {loading ? copy.listening : comment}
            {streaming && <span className="ml-0.5 inline-block h-4 w-1 translate-y-0.5 animate-pulse rounded-full bg-[#5b3e31]/70" />}
          </p>
          <div className="absolute -bottom-3 left-1/2 h-6 w-6 -translate-x-1/2 rotate-45 border-b border-r border-[#f5c184]/70 bg-[#ffe0bd]" />
        </div>
      )}
      {!loading && !commented && (
        <div className="absolute left-1/2 top-[40px] z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-[#ffd083]/80 bg-[#ffe0bd]/92 px-3.5 py-2 opacity-95 shadow-[0_0_24px_rgba(255,208,131,0.42),0_12px_30px_rgba(0,0,0,0.26)] backdrop-blur transition duration-300 group-hover:-translate-y-1 group-hover:border-[#fff0c8] group-hover:bg-[#fff1d5] group-hover:shadow-[0_0_34px_rgba(255,218,145,0.62),0_14px_34px_rgba(0,0,0,0.28)]">
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#5b3e31]"
              style={{ animationDelay: `${dot * 140}ms`, animationDuration: "900ms" }}
            />
          ))}
          <span className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-[#ffd083]/70 bg-[#ffe0bd]" />
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
      <div
        className={`relative z-10 mb-1 flex h-[clamp(200px,24vh,280px)] items-end justify-center transition duration-300 ${
          active ? "scale-[1.06] drop-shadow-[0_0_24px_rgba(255,218,145,0.74)]" : "drop-shadow-[0_24px_24px_rgba(0,0,0,0.46)] group-hover:scale-[1.025]"
        }`}
      >
        <Image
          src={`/characters/stage/${character.id}.png`}
          alt={label.name}
          width={512}
          height={512}
          className={`h-auto max-h-[clamp(210px,25vh,292px)] object-contain ${FIGURE_STYLE[character.id] || "w-[clamp(174px,11.6vw,224px)]"}`}
        />
      </div>
      <div
        className={`relative z-20 flex items-center gap-2 rounded-full border px-4 py-2 text-[#ffe8c9] backdrop-blur transition duration-300 ${
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

export default function ListenPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const copy = COPY[language];
  const mounted = useHydrated();
  const [initialState] = useState(getInitialListenState);
  const [selectedChars] = useState<Character[]>(initialState.selectedChars);
  const [allComments, setAllComments] = useState<Record<string, string>>(initialState.comments);
  const [visibleComments, setVisibleComments] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [streaming, setStreaming] = useState<Set<string>>(new Set());
  const [streamedOnce, setStreamedOnce] = useState<Set<string>>(new Set());
  const [resonantComments, setResonantComments] = useState<Set<string>>(new Set());
  const [activeCharacterId, setActiveCharacterId] = useState<string>(selectedChars[0]?.id || "");
  const [userNote, setUserNote] = useState("");
  const [showUserInput, setShowUserInput] = useState(false);
  const [showPlayerControls, setShowPlayerControls] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioSrc] = useState(initialState.audioSrc);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamTimersRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (selectedChars.length === 0) {
      router.push("/select");
    }
  }, [router, selectedChars.length]);

  useEffect(() => {
    if (!audioSrc) return;

    const audio = new Audio(audioSrc);
    audio.loop = true;
    const handleEnded = () => setIsPlaying(false);
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration || 0);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audioRef.current = null;
    };
  }, [audioSrc]);

  useEffect(() => {
    const timers = streamTimersRef.current;
    return () => {
      timers.forEach((timerId) => window.clearTimeout(timerId));
      timers.clear();
    };
  }, []);

  const togglePlay = async () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      await audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (value: string) => {
    const nextTime = Number(value);
    if (!audioRef.current || Number.isNaN(nextTime)) return;
    audioRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const fetchComment = useCallback(async (charId: string) => {
    const analysis = JSON.parse(sessionStorage.getItem("musicAnalysis") || "{}");

    const res = await fetch("/api/comment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterId: charId,
        musicAnalysis: analysis,
      }),
    });

    if (!res.ok) throw new Error("Comment API failed");
    const data = await res.json();
    return data.comment as string;
  }, []);

  const stopStreaming = useCallback((charId: string) => {
    const timerId = streamTimersRef.current.get(charId);
    if (timerId !== undefined) {
      window.clearTimeout(timerId);
      streamTimersRef.current.delete(charId);
    }
    setStreaming((prev) => {
      const next = new Set(prev);
      next.delete(charId);
      return next;
    });
  }, []);

  const streamComment = useCallback((charId: string, text: string) => {
    stopStreaming(charId);
    setRevealed((prev) => new Set(prev).add(charId));
    setVisibleComments((prev) => ({ ...prev, [charId]: "" }));
    setStreaming((prev) => new Set(prev).add(charId));

    let index = 0;
    const step = () => {
      index = Math.min(text.length, index + 1);
      setVisibleComments((prev) => ({ ...prev, [charId]: text.slice(0, index) }));

      if (index >= text.length) {
        streamTimersRef.current.delete(charId);
        setStreaming((prev) => {
          const next = new Set(prev);
          next.delete(charId);
          return next;
        });
        setStreamedOnce((prev) => new Set(prev).add(charId));
        return;
      }

      const char = text[index - 1] || "";
      const pause = /[，。！？,.!?]/.test(char) ? 150 : 58;
      const timerId = window.setTimeout(step, pause);
      streamTimersRef.current.set(charId, timerId);
    };

    const timerId = window.setTimeout(step, 180);
    streamTimersRef.current.set(charId, timerId);
  }, [stopStreaming]);

  const handleReveal = async (charId: string) => {
    if (loading.has(charId)) return;

    setActiveCharacterId(charId);

    if (allComments[charId]) {
      if (streamedOnce.has(charId)) {
        setVisibleComments((prev) => ({ ...prev, [charId]: allComments[charId] }));
        setRevealed((prev) => new Set(prev).add(charId));
        return;
      }
      streamComment(charId, allComments[charId]);
      return;
    }

    setLoading((prev) => new Set(prev).add(charId));

    try {
      const comment = await fetchComment(charId);
      setAllComments((prev) => ({ ...prev, [charId]: comment }));
      streamComment(charId, comment);
    } catch {
      setAllComments((prev) => ({ ...prev, [charId]: copy.failed }));
      streamComment(charId, copy.failed);
    } finally {
      setLoading((prev) => {
        const next = new Set(prev);
        next.delete(charId);
        return next;
      });
    }
  };

  const handleCloseBubble = (charId: string) => {
    stopStreaming(charId);
    setVisibleComments((prev) => ({ ...prev, [charId]: allComments[charId] || prev[charId] || "" }));
    setStreamedOnce((prev) => new Set(prev).add(charId));
    setRevealed((prev) => {
      const next = new Set(prev);
      next.delete(charId);
      return next;
    });
  };

  const toggleResonance = (charId: string) => {
    setResonantComments((prev) => {
      const next = new Set(prev);
      if (next.has(charId)) {
        next.delete(charId);
      } else {
        next.add(charId);
      }
      return next;
    });
  };

  const handleContinue = () => {
    const commentWeights = Object.fromEntries(
      Object.keys(allComments).map((characterId) => [
        characterId,
        {
          resonance: resonantComments.has(characterId),
          weight: resonantComments.has(characterId) ? 1.8 : 1,
        },
      ])
    );
    sessionStorage.setItem("comments", JSON.stringify(allComments));
    sessionStorage.setItem("commentWeights", JSON.stringify(commentWeights));
    sessionStorage.setItem("userNote", userNote);
    router.push("/generate-page");
  };

  const stageSlotsByCount: Record<number, string[]> = {
    1: ["left-[24%] bottom-[54px] -translate-x-1/2 translate-y-14"],
    2: [
      "left-[27%] bottom-[74px] -translate-x-1/2 translate-y-7",
      "right-[27%] bottom-[74px] translate-x-1/2 translate-y-7",
    ],
    3: [
      "left-[17%] bottom-[48px] -translate-x-1/2 translate-y-16",
      "left-[34%] bottom-[136px] -translate-x-1/2",
      "right-[17%] bottom-[48px] translate-x-1/2 translate-y-16",
    ],
    4: [
      "left-[17%] bottom-[48px] -translate-x-1/2 translate-y-16",
      "left-[37%] bottom-[144px] -translate-x-1/2",
      "right-[37%] bottom-[144px] translate-x-1/2",
      "right-[17%] bottom-[48px] translate-x-1/2 translate-y-16",
    ],
  };
  const stageSlots = stageSlotsByCount[Math.min(selectedChars.length, 4)] || stageSlotsByCount[4];

  if (!mounted) return null;

  return (
    <main className="relative h-screen overflow-hidden bg-[#15111c] text-[#f8dfbb]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,178,91,0.18),transparent_28%),radial-gradient(circle_at_50%_82%,rgba(255,183,92,0.14),transparent_34%),linear-gradient(135deg,#111420_0%,#2b2533_45%,#10121d_100%)]" />
      <div className="absolute inset-0 opacity-32 [background-image:linear-gradient(115deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(25deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:180px_180px,220px_220px]" />

      <div className="relative z-10 flex h-screen flex-col px-4 py-3 lg:px-6 lg:py-4 2xl:px-14 2xl:py-6">
        <FlowHeader activeStep={3} />

        <section className="relative mt-3 flex min-h-0 flex-1 overflow-hidden rounded-[26px] border border-[#9f6f45]/55 bg-[#251f2b]/38 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] 2xl:mt-5">
          <div className="absolute inset-0">
            <div className="absolute left-[-6%] right-[-6%] top-[26%] flex h-32 items-end justify-center gap-1 opacity-70">
              {Array.from({ length: 170 }).map((_, index) => (
                <span
                  key={index}
                  className="w-1 rounded-full bg-[#d99b4d] shadow-[0_0_10px_rgba(238,169,87,0.18)]"
                  style={{
                    height: `${(8 + Math.abs(Math.sin(index * 0.14)) * 82 + Math.abs(Math.cos(index * 0.045)) * 18).toFixed(2)}px`,
                    opacity: (0.2 + Math.abs(Math.sin(index * 0.21)) * 0.54).toFixed(3),
                  }}
                />
              ))}
            </div>
            {["♪", "♫", "♩", "♬", "♪", "♫"].map((note, index) => (
              <span
                key={`${note}-${index}`}
                className="absolute text-4xl text-[#eaa957]/54"
                style={{
                  left: `${7 + index * 17}%`,
                  top: `${17 + (index % 3) * 12}%`,
                }}
              >
                {note}
              </span>
            ))}
            <div className="absolute bottom-[-148px] left-1/2 h-[520px] w-[1480px] -translate-x-1/2 rounded-[50%] border border-[#d09a62]/34 bg-[#6f5949]/24 shadow-[0_30px_120px_rgba(0,0,0,0.52),inset_0_18px_52px_rgba(255,186,98,0.08)]" />
            <div className="absolute bottom-[-106px] left-1/2 h-[410px] w-[1240px] -translate-x-1/2 rounded-[50%] border border-[#bd8756]/28" />
            <div className="absolute bottom-[-64px] left-1/2 h-[300px] w-[940px] -translate-x-1/2 rounded-[50%] border border-[#d8a464]/22" />
            <div className="absolute bottom-[58px] left-1/2 h-[120px] w-[520px] -translate-x-1/2 rounded-[50%] border border-[#f5c072]/24 bg-[#ffc267]/8 blur-[1px]" />
            <div className="absolute bottom-[8px] left-1/2 h-[420px] w-[2px] -translate-x-1/2 bg-gradient-to-t from-[#e2a665]/28 to-transparent" />
            <div className="absolute bottom-[18px] left-[28%] h-[360px] w-[1px] -rotate-[16deg] bg-gradient-to-t from-[#c99560]/20 to-transparent" />
            <div className="absolute bottom-[18px] right-[28%] h-[360px] w-[1px] rotate-[16deg] bg-gradient-to-t from-[#c99560]/20 to-transparent" />
          </div>
          <p className="pointer-events-none absolute left-1/2 top-4 z-20 max-w-[min(880px,82vw)] -translate-x-1/2 text-center font-serif text-[clamp(18px,1.55vw,28px)] font-semibold text-[#ffe4ba]/90 drop-shadow-[0_0_16px_rgba(255,194,103,0.28)] 2xl:top-5">
            {copy.guideTip}
          </p>

          <div className="relative z-10 flex min-w-0 flex-1 flex-col px-6 pb-5 pt-4 2xl:px-9 2xl:pb-7">
            <div className="relative flex min-h-0 flex-1 items-end justify-center pb-[clamp(92px,11vh,124px)]">
              <div className="pointer-events-none absolute bottom-[38px] left-1/2 z-0 h-[390px] w-[min(1180px,92vw)] -translate-x-1/2 rounded-[50%] border border-[#dba66a]/18 bg-[radial-gradient(ellipse_at_center,rgba(255,194,103,0.12)_0%,rgba(255,194,103,0.06)_32%,rgba(18,16,24,0)_70%)]" />
              <div className="pointer-events-none absolute bottom-[90px] left-1/2 z-0 h-[210px] w-[min(760px,62vw)] -translate-x-1/2 rounded-[50%] border border-[#ffcf7d]/20" />

              {showPlayerControls && (
                <div className="absolute left-1/2 top-[86px] z-30 flex h-[58px] w-[min(620px,52vw)] -translate-x-1/2 items-center gap-4 rounded-full border border-[#ca8f53]/62 bg-[#1e1923]/86 px-4 shadow-[0_18px_48px_rgba(0,0,0,0.34),0_0_24px_rgba(255,194,103,0.1)] backdrop-blur">
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#ffe2bd] text-lg font-semibold text-[#382832] shadow-[0_0_24px_rgba(255,203,131,0.38)]"
                    aria-label={isPlaying ? copy.pause : copy.play}
                  >
                    {isPlaying ? "Ⅱ" : "▶"}
                  </button>
                  <div className="relative flex min-w-0 flex-1 items-center">
                    <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center gap-[3px]">
                      {Array.from({ length: 52 }).map((_, index) => (
                        <span
                          key={index}
                          className="w-[3px] rounded-full bg-[#e5a45b]"
                          style={{
                            height: `${(6 + Math.abs(Math.sin(index * 0.58)) * 22).toFixed(1)}px`,
                            opacity: index / 52 <= (duration ? currentTime / duration : 0) ? 0.96 : 0.24,
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
                      className="relative z-10 h-9 w-full cursor-pointer appearance-none bg-transparent accent-[#ffc267] opacity-0"
                      aria-label={copy.progress}
                    />
                  </div>
                  <span className="shrink-0 text-sm font-medium text-[#ffe0bd]">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>
              )}

              {selectedChars.map((character, index) => (
                <GuideFigure
                  key={character.id}
                  character={character}
                  active={character.id === activeCharacterId}
                  commented={revealed.has(character.id)}
                  loading={loading.has(character.id)}
                  streaming={streaming.has(character.id)}
                  comment={visibleComments[character.id] || ""}
                  resonant={resonantComments.has(character.id)}
                  stageOffset={stageSlots[index] || stageSlots[stageSlots.length - 1]}
                  onClick={() => handleReveal(character.id)}
                  onClose={() => handleCloseBubble(character.id)}
                  onToggleResonance={() => toggleResonance(character.id)}
                  language={language}
                />
              ))}

              <div className="absolute bottom-[98px] left-1/2 z-20 h-[clamp(250px,21vw,326px)] w-[min(560px,44vw)] -translate-x-1/2">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="group/crystal absolute left-1/2 top-0 flex h-[clamp(226px,19vw,296px)] w-[clamp(226px,19vw,296px)] -translate-x-1/2 cursor-pointer items-center justify-center rounded-full outline-none"
                  aria-label={isPlaying ? copy.pause : copy.play}
                >
                  <div
                    className={`absolute inset-3 rounded-full bg-[#ffc267]/18 blur-2xl transition duration-500 ${
                      isPlaying ? "scale-125 opacity-100" : "scale-95 opacity-42 group-hover/crystal:scale-110 group-hover/crystal:opacity-80"
                    }`}
                  />
                  <div
                    className={`absolute inset-0 rounded-full border border-[#ffd98b]/32 transition duration-500 ${
                      isPlaying ? "scale-110 opacity-80 shadow-[0_0_54px_rgba(255,196,99,0.48)]" : "scale-95 opacity-35 group-hover/crystal:scale-105 group-hover/crystal:opacity-65"
                    }`}
                  />
                  <div
                    className={`absolute inset-7 rounded-full border border-[#f7b968]/36 transition duration-500 ${
                      isPlaying ? "animate-pulse bg-[#f8b65e]/12" : "bg-[#72533f]/16 group-hover/crystal:bg-[#f8b65e]/10"
                    }`}
                  />
                  {CRYSTAL_RING_BARS.map((height, index) => (
                    <span
                      key={index}
                      className="absolute left-1/2 top-1/2 w-1 origin-bottom rounded-full bg-[#ffc267]"
                      style={{
                        height: `${isPlaying ? height : height * 0.42}px`,
                        opacity: isPlaying ? 0.34 + Math.abs(Math.sin(index * 0.71)) * 0.48 : 0.13,
                        transform: `translate(-50%, -50%) rotate(${index * 10}deg) translateY(-${isPlaying ? 128 : 106}px)`,
                        transition: "height 360ms ease, opacity 360ms ease, transform 360ms ease",
                      }}
                    />
                  ))}
                  <div className="absolute bottom-[15%] h-[82px] w-[224px] rounded-[50%] border border-[#f3bb75]/42 bg-[#72533f]/42 shadow-[0_18px_66px_rgba(0,0,0,0.46),0_0_34px_rgba(255,195,97,0.16)]" />
                  <Image
                    src="/stage-gem-transparent.webp"
                    alt=""
                    width={1254}
                    height={1254}
                    unoptimized
                    className={`relative z-10 h-auto w-[clamp(178px,14vw,236px)] opacity-95 transition duration-500 ${
                      isPlaying
                        ? "scale-[1.05] brightness-110 drop-shadow-[0_0_42px_rgba(255,205,116,0.62)]"
                        : "drop-shadow-[0_0_24px_rgba(255,195,97,0.34)] group-hover/crystal:scale-[1.03] group-hover/crystal:brightness-110 group-hover/crystal:drop-shadow-[0_0_48px_rgba(255,208,126,0.58)]"
                    }`}
                  />
                </button>

                <button
                  type="button"
                  onClick={() => setShowPlayerControls((prev) => !prev)}
                  className="absolute bottom-[44px] left-1/2 z-20 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-[#c9965d]/46 bg-[#1f1a24]/82 text-[#ffe3bd] shadow-[0_12px_30px_rgba(0,0,0,0.28)]"
                  aria-label={showPlayerControls ? copy.collapseProgress : copy.expandProgress}
                >
                  {showPlayerControls ? "⌄" : "⌃"}
                </button>

              </div>
            </div>

            <div className="absolute bottom-4 left-1/2 z-[80] flex w-[320px] -translate-x-1/2 flex-col items-center gap-3">
              {!showUserInput && (
                <button
                  type="button"
                  onClick={() => setShowUserInput(true)}
                  className="rounded-full border border-[#c9965d]/38 bg-[#1f1a24]/70 px-5 py-2 text-center text-xs text-[#d7bfa7] shadow-[0_12px_32px_rgba(0,0,0,0.24)] backdrop-blur transition hover:border-[#d8aa70]/62 hover:text-[#ffe3bd]"
                >
                  {copy.addFeeling}
                </button>
              )}
              {showUserInput && (
                <div className="flex h-[56px] w-[min(380px,88vw)] items-center gap-3 rounded-full border border-[#c9965d]/50 bg-[#1f1a24]/92 px-4 shadow-[0_18px_58px_rgba(0,0,0,0.36)] backdrop-blur">
                  <p className="shrink-0 text-sm font-semibold text-[#ffe3bd]">{copy.myFeeling}</p>
                  <textarea
                    value={userNote}
                    onChange={(event) => setUserNote(event.target.value)}
                    placeholder={copy.feelingPlaceholder}
                    className="h-9 min-w-0 flex-1 resize-none rounded-full border border-[#8f6c52]/48 bg-[#15111c]/72 px-3 py-2 text-sm leading-tight text-[#ffe3bd] outline-none placeholder:text-[#bda28b]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowUserInput(false)}
                    className="shrink-0 text-xs text-[#d7bfa7] transition hover:text-[#ffe3bd]"
                  >
                    {copy.collapse}
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={handleContinue}
                disabled={revealed.size === 0}
                className="flex h-[64px] w-full items-center justify-center rounded-[18px] border border-[#f4bd72]/62 bg-[#2d2631]/88 px-5 text-base font-semibold text-[#ffe3bd] shadow-[0_16px_44px_rgba(0,0,0,0.32)] transition hover:bg-[#3a2d37] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {copy.generate}
              </button>
            </div>
          </div>

        </section>
      </div>
    </main>
  );
}
