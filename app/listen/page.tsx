"use client";

import Image from "next/image";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getCharactersByIds, Character } from "@/lib/characters";
import FlowHeader from "@/components/FlowHeader";

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
  comment,
  stageOffset,
  onClick,
}: {
  character: Character;
  active: boolean;
  commented: boolean;
  loading: boolean;
  comment: string;
  stageOffset: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`group absolute z-40 flex w-[clamp(178px,14vw,230px)] flex-col items-center pt-[clamp(104px,12vh,132px)] text-center transition duration-500 ${stageOffset}`}
    >
      {(loading || commented) && (
        <div className="absolute left-1/2 top-0 z-50 w-[clamp(196px,14vw,232px)] -translate-x-1/2 rounded-[18px] border border-[#f5c184]/70 bg-[#ffe0bd]/94 px-4 py-3 text-left text-[#322534] shadow-[0_14px_34px_rgba(0,0,0,0.26)]">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">{character.name}</p>
            <span className="h-1 w-1 rounded-full bg-[#5a3e31]" />
            <p className="text-xs text-[#765846]">{character.focusKeyword}</p>
          </div>
          <p className="mt-2 max-h-[4.8em] overflow-hidden text-sm font-medium leading-relaxed">
            {loading ? "我正在听这段音乐，稍等片刻……" : comment}
          </p>
          <div className="absolute -bottom-3 left-1/2 h-6 w-6 -translate-x-1/2 rotate-45 border-b border-r border-[#f5c184]/70 bg-[#ffe0bd]" />
        </div>
      )}
      <div
        className={`absolute bottom-[48px] h-[clamp(48px,5.6vw,76px)] w-[clamp(142px,11vw,196px)] rounded-[50%] border transition duration-300 ${
          active
            ? "border-[#ffd481] bg-[#ffc267]/24 shadow-[0_0_34px_rgba(255,194,103,0.85)]"
            : "border-[#b9895d]/38 bg-black/24 shadow-[0_22px_48px_rgba(0,0,0,0.36)] group-hover:border-[#dba35f]/75"
        }`}
      />
      <div
        className={`relative z-10 mb-1 flex h-[clamp(200px,24vh,280px)] items-end justify-center transition duration-300 ${
          active ? "scale-[1.06] drop-shadow-[0_0_24px_rgba(255,218,145,0.74)]" : "drop-shadow-[0_24px_24px_rgba(0,0,0,0.46)] group-hover:scale-[1.025]"
        }`}
      >
        <Image
          src={`/characters/stage/${character.id}.png`}
          alt={character.name}
          width={512}
          height={512}
          unoptimized
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
        <p className="text-sm font-semibold">{character.name}</p>
      </div>
    </button>
  );
}

export default function ListenPage() {
  const router = useRouter();
  const [initialState] = useState(getInitialListenState);
  const [selectedChars] = useState<Character[]>(initialState.selectedChars);
  const [allComments, setAllComments] = useState<Record<string, string>>(initialState.comments);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [activeCharacterId, setActiveCharacterId] = useState<string>(selectedChars[0]?.id || "");
  const [userNote, setUserNote] = useState("");
  const [showUserInput, setShowUserInput] = useState(false);
  const [showPlayerControls, setShowPlayerControls] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioSrc] = useState(initialState.audioSrc);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  const handleReveal = async (charId: string) => {
    if (loading.has(charId)) return;

    setActiveCharacterId(charId);

    if (allComments[charId]) {
      setRevealed((prev) => new Set(prev).add(charId));
      return;
    }

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

  const stageSlotsByCount: Record<number, string[]> = {
    1: ["left-1/2 bottom-[78px] -translate-x-1/2"],
    2: [
      "left-[24%] bottom-[74px] -translate-x-1/2 translate-y-8",
      "right-[24%] bottom-[74px] translate-x-1/2 translate-y-8",
    ],
    3: [
      "left-[18%] bottom-[52px] -translate-x-1/2 translate-y-14",
      "left-1/2 bottom-[150px] -translate-x-1/2 -translate-y-1",
      "right-[18%] bottom-[52px] translate-x-1/2 translate-y-14",
    ],
    4: [
      "left-[15%] bottom-[46px] -translate-x-1/2 translate-y-16",
      "left-[36%] bottom-[138px] -translate-x-1/2",
      "right-[36%] bottom-[138px] translate-x-1/2",
      "right-[15%] bottom-[46px] translate-x-1/2 translate-y-16",
    ],
  };
  const stageSlots = stageSlotsByCount[Math.min(selectedChars.length, 4)] || stageSlotsByCount[4];

  return (
    <main className="relative h-screen overflow-hidden bg-[#15111c] text-[#f8dfbb]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_51%_38%,rgba(255,183,92,0.2),transparent_23%),radial-gradient(circle_at_18%_86%,rgba(255,177,84,0.16),transparent_20%),linear-gradient(135deg,#171623_0%,#2d2735_45%,#11121c_100%)]" />
      <div className="absolute inset-0 opacity-42 [background-image:linear-gradient(115deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(25deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:180px_180px,220px_220px]" />

      <div className="relative z-10 flex h-screen flex-col px-4 py-3 lg:px-6 lg:py-4 2xl:px-14 2xl:py-6">
        <FlowHeader activeStep={3} />

        <section className="relative mt-3 flex min-h-0 flex-1 overflow-hidden rounded-[26px] border border-[#9f6f45]/55 bg-[#251f2b]/38 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] 2xl:mt-5">
          <div className="absolute inset-0">
            <div className="absolute left-[-8%] right-[9%] top-[27%] flex h-28 items-end justify-center gap-1 opacity-68">
              {Array.from({ length: 170 }).map((_, index) => (
                <span
                  key={index}
                  className="w-1 rounded-full bg-[#d99b4d]"
                  style={{
                    height: `${(6 + Math.abs(Math.sin(index * 0.16)) * 72).toFixed(2)}px`,
                    opacity: (0.18 + Math.abs(Math.sin(index * 0.23)) * 0.5).toFixed(3),
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
            <div className="absolute bottom-[-118px] left-1/2 h-[410px] w-[1320px] -translate-x-1/2 rounded-[50%] border border-[#b88552]/30 bg-[#76604f]/24 shadow-[0_28px_110px_rgba(0,0,0,0.45)]" />
            <div className="absolute bottom-[-168px] left-1/2 h-[330px] w-[1140px] -translate-x-1/2 rounded-[50%] border border-[#b88552]/24 bg-[#665148]/32" />
          </div>

          <div className="relative z-10 flex min-w-0 flex-1 flex-col px-6 pb-5 pt-4 2xl:px-9 2xl:pb-7">
            <div className="relative flex min-h-0 flex-1 items-end justify-center pb-[clamp(92px,11vh,124px)]">
              {selectedChars.map((character, index) => (
                <GuideFigure
                  key={character.id}
                  character={character}
                  active={character.id === activeCharacterId}
                  commented={revealed.has(character.id)}
                  loading={loading.has(character.id)}
                  comment={allComments[character.id] || ""}
                  stageOffset={stageSlots[index] || stageSlots[stageSlots.length - 1]}
                  onClick={() => handleReveal(character.id)}
                />
              ))}

              <div className="absolute bottom-[84px] left-1/2 z-20 h-[clamp(250px,21vw,326px)] w-[min(560px,44vw)] -translate-x-1/2">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="group/crystal absolute left-1/2 top-0 flex h-[clamp(226px,19vw,296px)] w-[clamp(226px,19vw,296px)] -translate-x-1/2 cursor-pointer items-center justify-center rounded-full outline-none"
                  aria-label={isPlaying ? "暂停音乐" : "播放音乐"}
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
                  <div className="absolute bottom-[17%] h-[78px] w-[208px] rounded-[50%] border border-[#f3bb75]/34 bg-[#72533f]/38 shadow-[0_18px_66px_rgba(0,0,0,0.42)]" />
                  <Image
                    src="/stage-gem-transparent.png"
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
                  className="absolute bottom-[18px] left-1/2 z-20 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-[#c9965d]/46 bg-[#1f1a24]/82 text-[#ffe3bd] shadow-[0_12px_30px_rgba(0,0,0,0.28)]"
                  aria-label={showPlayerControls ? "收起播放进度" : "展开播放进度"}
                >
                  {showPlayerControls ? "⌃" : "⌄"}
                </button>

                {showPlayerControls && (
                  <div className="absolute bottom-[58px] left-1/2 z-20 w-[min(520px,42vw)] -translate-x-1/2 rounded-full border border-[#ca8f53]/58 bg-[#1e1923]/82 px-5 py-3 shadow-[0_16px_48px_rgba(0,0,0,0.3)] backdrop-blur">
                    <div className="flex items-center gap-3 text-xs text-[#ffe0bd]">
                      <span>{formatTime(currentTime)}</span>
                      <input
                        type="range"
                        min={0}
                        max={duration || currentTime || 1}
                        step={0.1}
                        value={Math.min(currentTime, duration || currentTime)}
                        onChange={(event) => handleSeek(event.target.value)}
                        className="h-1 flex-1 accent-[#ffc267]"
                      />
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="absolute bottom-5 left-1/2 z-50 flex w-[320px] -translate-x-1/2 flex-col items-center gap-3">
              {!showUserInput && (
                <button
                  type="button"
                  onClick={() => setShowUserInput(true)}
                  className="rounded-full border border-[#c9965d]/38 bg-[#1f1a24]/70 px-5 py-2 text-center text-xs text-[#d7bfa7] shadow-[0_12px_32px_rgba(0,0,0,0.24)] backdrop-blur transition hover:border-[#d8aa70]/62 hover:text-[#ffe3bd]"
                >
                  点击可补充你的听感
                </button>
              )}
              {showUserInput && (
                <div className="w-full rounded-[20px] border border-[#c9965d]/46 bg-[#1f1a24]/92 p-4 shadow-[0_18px_58px_rgba(0,0,0,0.36)] backdrop-blur">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-[#ffe3bd]">我的感受</p>
                    <button
                      type="button"
                      onClick={() => setShowUserInput(false)}
                      className="text-xs text-[#d7bfa7] transition hover:text-[#ffe3bd]"
                    >
                      收起
                    </button>
                  </div>
                  <textarea
                    value={userNote}
                    onChange={(event) => setUserNote(event.target.value)}
                    placeholder="我也想说两句（可选）"
                    className="h-20 w-full resize-none rounded-2xl border border-[#8f6c52]/55 bg-[#15111c]/72 p-3 text-sm text-[#ffe3bd] outline-none placeholder:text-[#bda28b]"
                  />
                </div>
              )}
              <button
                type="button"
                onClick={handleContinue}
                disabled={revealed.size === 0}
                className="flex h-[64px] w-full items-center justify-center rounded-[18px] border border-[#f4bd72]/62 bg-[#2d2631]/88 px-5 text-base font-semibold text-[#ffe3bd] shadow-[0_16px_44px_rgba(0,0,0,0.32)] transition hover:bg-[#3a2d37] disabled:cursor-not-allowed disabled:opacity-45"
              >
                生成画作 →
              </button>
            </div>
          </div>

        </section>
      </div>
    </main>
  );
}
