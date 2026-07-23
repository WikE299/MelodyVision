"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import CrystalAudioVisualizer, {
  type CrystalVisualizationMode,
} from "@/components/CrystalAudioVisualizer";
import { audioCatalog, getAudioPlaybackUrl } from "@/lib/audio/catalog";

const MODES: Array<{ id: CrystalVisualizationMode; label: string; detail: string }> = [
  { id: "corona", label: "光冠", detail: "轮廓与放射" },
  { id: "ripples", label: "涟漪", detail: "低频与余韵" },
  { id: "pulse", label: "脉冲", detail: "频谱与重拍" },
];

function formatTime(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "00:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function VisualizerLabPage() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [mode, setMode] = useState<CrystalVisualizationMode>("pulse");
  const [audioId, setAudioId] = useState("beethoven-symphony-5");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const selectedAudio = useMemo(
    () => audioCatalog.find((item) => item.id === audioId) || audioCatalog[0],
    [audioId]
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    audio.load();
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
  }, [audioId]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try {
        await audio.play();
      } catch (error) {
        console.warn("Visualizer lab playback failed:", error);
      }
    } else {
      audio.pause();
    }
  };

  return (
    <main className="relative h-screen overflow-hidden bg-[#15111c] text-[#f8dfbb]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(255,176,83,0.12),transparent_28%),linear-gradient(145deg,#11131d_0%,#2a2430_48%,#11131d_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:linear-gradient(110deg,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:190px_190px]" />

      <div className="relative z-10 flex h-full flex-col px-5 py-4 lg:px-8 lg:py-5">
        <header className="flex shrink-0 items-center justify-between gap-5 border-b border-[#765a45]/44 pb-4">
          <div className="flex min-w-0 items-center gap-4">
            <a
              href="/listen"
              className="flex h-9 w-9 shrink-0 items-center justify-center border border-[#9b704d]/58 text-lg text-[#f7d3a4] transition hover:border-[#ffd083] hover:bg-[#342a31]"
              aria-label="返回聆听页"
              title="返回聆听页"
            >
              ←
            </a>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#c99358]">MelodyVision Lab</p>
              <h1 className="truncate font-serif text-xl font-semibold text-[#ffe0b7]">水晶音乐光效实验室</h1>
            </div>
          </div>

          <div className="flex border border-[#8a664b]/52 bg-[#211c25]/76 p-1" role="group" aria-label="光效模式">
            {MODES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setMode(item.id)}
                className={`min-w-[112px] px-4 py-2 text-left transition ${
                  mode === item.id
                    ? "bg-[#694536] text-[#ffe1b8] shadow-[0_0_24px_rgba(239,177,95,0.14)]"
                    : "text-[#bda78e] hover:bg-[#342832] hover:text-[#f2cfa4]"
                }`}
                aria-pressed={mode === item.id}
              >
                <span className="block text-sm font-semibold">{item.label}</span>
                <span className="mt-0.5 block text-[10px] opacity-70">{item.detail}</span>
              </button>
            ))}
          </div>
        </header>

        <section className="relative flex min-h-0 flex-1 items-center justify-center">
          <div className="pointer-events-none absolute bottom-[4%] left-1/2 h-[28%] w-[72%] -translate-x-1/2 rounded-[50%] border border-[#bd8756]/22 bg-[#73543d]/10 shadow-[0_24px_90px_rgba(0,0,0,0.52),inset_0_12px_42px_rgba(255,186,98,0.06)]" />
          <div className="relative h-[min(64vh,620px)] w-[min(64vh,620px)] min-h-[390px] min-w-[390px]">
            <CrystalAudioVisualizer
              audioRef={audioRef}
              active={isPlaying}
              mode={mode}
            >
              <Image
                src="/stage-gem-transparent.webp"
                alt="黄色水晶"
                width={1254}
                height={1254}
                priority
                unoptimized
                className="h-auto w-[clamp(190px,20vw,270px)] opacity-95"
              />
            </CrystalAudioVisualizer>
          </div>

        </section>

        <footer className="mx-auto flex w-[min(920px,92vw)] shrink-0 items-center gap-4 border-t border-[#8b674d]/52 bg-[#211c25]/68 px-4 py-3 backdrop-blur">
          <button
            type="button"
            onClick={() => void togglePlay()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f4d09a] text-sm font-semibold text-[#342831] transition hover:bg-white"
            aria-label={isPlaying ? "暂停" : "播放"}
            title={isPlaying ? "暂停" : "播放"}
          >
            {isPlaying ? "Ⅱ" : "▶"}
          </button>

          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#ffe1b8]">{selectedAudio.name}</p>
                <p className="truncate text-[10px] text-[#bba184]">{selectedAudio.artist}</p>
              </div>
              <select
                value={audioId}
                onChange={(event) => setAudioId(event.target.value)}
                className="h-8 max-w-[250px] border border-[#8a664b]/58 bg-[#2a232d] px-2 text-xs text-[#f1d0a7] outline-none focus:border-[#efb15f]"
                aria-label="选择测试音乐"
              >
                {audioCatalog.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </div>
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.1}
              value={Math.min(currentTime, duration || 0)}
              onChange={(event) => {
                const nextTime = Number(event.target.value);
                if (!audioRef.current || !Number.isFinite(nextTime)) return;
                audioRef.current.currentTime = nextTime;
                setCurrentTime(nextTime);
              }}
              className="h-1.5 w-full cursor-pointer accent-[#efb15f]"
              aria-label="音乐进度"
            />
          </div>
          <span className="w-[92px] shrink-0 text-right text-xs tabular-nums text-[#d6b792]">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <audio
            ref={audioRef}
            src={getAudioPlaybackUrl(selectedAudio)}
            preload="metadata"
            onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
            onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime || 0)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
          />
        </footer>
      </div>
    </main>
  );
}
