"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import AudioUploader from "@/components/AudioUploader";
import FlowHeader from "@/components/FlowHeader";
import { audioCatalog, searchAudioCatalog, type AudioCatalogItem } from "@/lib/audio/catalog";
import { analyzeAudioFile } from "@/lib/audio/web-analyzer";
import { useLanguage } from "@/lib/i18n";

type InputMode = "examples" | "search" | "upload";

const COPY = {
  zh: {
    productHint: "选一段声音，邀请音乐家聆听，再把感受变成画作。",
    analyzing: "正在分析音乐...",
    analyzeFailed: "音频分析失败，请换一段音频再试。",
    exampleFailed: "示例音频加载失败，请稍后再试或上传自己的音频。",
    modes: {
      examples: {
        title: "试试示例",
        desc: "没有音频文件也能立刻体验",
      },
      search: {
        title: "搜索音乐",
        desc: "从受控音源库中匹配",
      },
      upload: {
        title: "上传音频",
        desc: "已有音频文件？从这里开始",
      },
    },
    examplesTitle: "推荐示例",
    examplesDesc: "先用项目内置音频跑通完整链路，后续可继续补充更多授权曲目。",
    startWithThis: "用这段开始",
    preview: "试听",
    seconds: "秒",
    tags: "标签",
    source: "来源",
    license: "授权",
    searchPlaceholder: "输入曲名、风格、情绪或场景",
    searchEmpty: "暂时没有匹配结果，可以改用示例或上传自己的音频。",
    uploadTitle: "已有音频文件？上传自己的音乐",
  },
  en: {
    productHint: "Choose a sound, invite musicians to listen, then turn the response into an artwork.",
    analyzing: "Analyzing your music...",
    analyzeFailed: "Audio analysis failed. Please try another file.",
    exampleFailed: "The example audio could not be loaded. Try again later or upload your own audio.",
    modes: {
      examples: {
        title: "Try Example",
        desc: "Start instantly without a file",
      },
      search: {
        title: "Search Music",
        desc: "Match from a controlled library",
      },
      upload: {
        title: "Upload Audio",
        desc: "Use your own audio file",
      },
    },
    examplesTitle: "Featured Example",
    examplesDesc: "Use a local demo track to run the full flow. More licensed tracks can be added later.",
    startWithThis: "Start with this",
    preview: "Preview",
    seconds: "sec",
    tags: "Tags",
    source: "Source",
    license: "License",
    searchPlaceholder: "Search by title, style, mood, or scene",
    searchEmpty: "No matches yet. Try the example or upload your own audio.",
    uploadTitle: "Have an audio file? Upload your own music",
  },
};

const INPUT_MODES: InputMode[] = ["examples", "search", "upload"];

function formatDuration(seconds: number, suffix: string) {
  return `${Math.round(seconds)} ${suffix}`;
}

export default function HomePageClient() {
  const router = useRouter();
  const { language } = useLanguage();
  const [activeInputMode, setActiveInputMode] = useState<InputMode | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = COPY[language];
  const visibleCatalog = activeInputMode === "search" ? searchAudioCatalog(searchQuery) : audioCatalog;

  const handleFileSelect = async (file: File, sourceUrl?: string) => {
    setAnalyzing(true);
    setError(null);

    try {
      sessionStorage.setItem("audioFileName", file.name);
      sessionStorage.setItem("audioFileSize", String(file.size));
      if (sourceUrl) {
        sessionStorage.setItem("audioSrc", sourceUrl);
      } else {
        sessionStorage.removeItem("audioSrc");
      }

      const url = URL.createObjectURL(file);
      sessionStorage.setItem("audioObjectUrl", url);

      const features = await analyzeAudioFile(file);
      const analysis = {
        tempo: features.tempo,
        mood: features.mood,
        energy: features.energy,
        brightness: features.brightness,
        dynamicRange: features.dynamicRange,
        bpm: features.bpm,
        duration: features.durationSeconds,
        description: features.description,
        segments: features.segments,
        salientMoments: features.salientMoments,
        curves: features.curves,
        visualMappingHints: features.visualMappingHints,
        spectralCentroid: features.spectralCentroid,
        spectralFlatness: features.spectralFlatness,
        spectralRolloff: features.spectralRolloff,
      };
      sessionStorage.setItem("musicAnalysis", JSON.stringify(analysis));

      router.push("/select");
    } catch (err) {
      console.error("Audio analysis failed:", err);
      setAnalyzing(false);
      setError(copy.analyzeFailed);
    }
  };

  const handleCatalogSelect = async (item: AudioCatalogItem) => {
    if (analyzing) return;
    setAnalyzing(true);
    setError(null);

    try {
      const res = await fetch(item.file);
      if (!res.ok) throw new Error(`Failed to load ${item.file}`);
      const blob = await res.blob();
      const file = new File([blob], `${item.name}.mp3`, { type: blob.type || "audio/mpeg" });
      await handleFileSelect(file, item.file);
    } catch (err) {
      console.error("Preset audio failed:", err);
      setAnalyzing(false);
      setError(copy.exampleFailed);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#15111c] text-[#f8dfbb]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_52%,rgba(255,176,86,0.28),transparent_26%),radial-gradient(circle_at_18%_85%,rgba(255,183,92,0.2),transparent_20%),linear-gradient(135deg,#191526_0%,#302638_44%,#12111b_100%)]" />
      <div className="absolute inset-0 opacity-45 [background-image:linear-gradient(115deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(25deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:180px_180px,220px_220px]" />
      <div className="absolute left-[6%] top-[20%] h-24 w-24 rotate-45 border border-white/8 bg-white/5" />
      <div className="absolute right-[4%] top-[18%] h-32 w-32 rotate-12 border border-white/8 bg-white/5" />
      <div className="absolute bottom-[9%] left-[3%] h-28 w-28 rotate-12 border border-white/8 bg-black/20" />

      <div className="relative z-10 flex min-h-screen flex-col px-4 py-3 lg:px-6 lg:py-4 2xl:px-14 2xl:py-6">
        <FlowHeader activeStep={1} />

        <section className="relative mt-6 flex flex-1 items-center justify-center rounded-[42px] border border-[#9f6f45]/75 bg-[#261f2a]/45 px-10 py-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <div className="absolute inset-0 overflow-hidden rounded-[42px]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_34%,rgba(255,211,138,0.28),transparent_22%),radial-gradient(circle_at_50%_76%,rgba(255,167,77,0.2),transparent_30%),linear-gradient(180deg,rgba(30,25,38,0.08),rgba(18,15,27,0.42))]" />
            <div className="absolute left-[8%] right-[8%] top-[44%] h-px bg-[#f0b45e]/18" />
            <div className="absolute left-[13%] right-[13%] top-[42%] flex h-32 items-end justify-center gap-1 opacity-70">
              {Array.from({ length: 90 }).map((_, index) => (
                <span
                  key={index}
                  className="w-1 rounded-full bg-[#ffc268]"
                  style={{
                    height: `${(10 + Math.abs(Math.sin(index * 0.2)) * 82).toFixed(2)}px`,
                    opacity: (0.18 + Math.abs(Math.sin(index * 0.24)) * 0.52).toFixed(3),
                  }}
                />
              ))}
            </div>
            {["♪", "♫", "♪", "♬", "♪", "♫"].map((note, index) => (
              <span
                key={`${note}-${index}`}
                className="absolute text-4xl text-[#eaa957]/55"
                style={{
                  left: `${12 + index * 14}%`,
                  top: `${20 + (index % 3) * 13}%`,
                }}
              >
                {note}
              </span>
            ))}
            <div className="absolute left-[8%] top-[22%] h-36 w-36 rotate-45 border border-white/8 bg-white/5" />
            <div className="absolute right-[9%] top-[20%] h-28 w-28 rotate-12 border border-[#f8c078]/15 bg-[#e5a760]/10" />
            <div className="absolute bottom-[6%] left-[12%] h-24 w-24 rotate-12 border border-white/8 bg-black/18" />
            <div className="absolute bottom-[12%] right-[12%] h-20 w-20 rotate-45 border border-[#efb263]/12 bg-black/18" />
          </div>

          <div className="relative flex min-h-[610px] w-full max-w-[1240px] flex-col items-center justify-end">
            <div className="absolute top-1 h-[430px] w-[760px] rounded-full bg-[#ffbd68]/16 blur-3xl" />
            <div className="absolute top-[58px] h-[300px] w-[940px] rounded-[50%] border border-[#f3b66e]/12 bg-[#7d604a]/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" />
            <div className="absolute top-[100px] h-[380px] w-[980px] rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgba(255,194,106,0.18),rgba(128,88,67,0.14)_44%,transparent_72%)]" />
            <div className="group/crystal absolute top-[-18px] w-[610px] cursor-default opacity-95 drop-shadow-[0_34px_76px_rgba(0,0,0,0.36)]">
              <div className="absolute left-1/2 top-[14%] h-[360px] w-[360px] -translate-x-1/2 rounded-full border border-[#ffd98b]/0 bg-[#ffbf68]/0 opacity-0 blur-[1px] transition-all duration-500 group-hover/crystal:border-[#ffd98b]/55 group-hover/crystal:bg-[#ffbf68]/10 group-hover/crystal:opacity-100" />
              <div className="absolute left-1/2 top-[28%] h-[260px] w-[360px] -translate-x-1/2 rounded-[50%] bg-[#ffd27a]/0 blur-3xl transition-all duration-500 group-hover/crystal:bg-[#ffd27a]/22" />
                <Image
                  src="/stage-gem-transparent.png"
                  alt=""
                  width={1254}
                  height={1254}
                  priority
                  unoptimized
                  className="relative h-auto w-full transition duration-500 group-hover/crystal:scale-[1.012] group-hover/crystal:brightness-110 group-hover/crystal:drop-shadow-[0_0_38px_rgba(255,213,126,0.5)]"
                />
            </div>
            <div className="absolute top-[388px] h-[126px] w-[820px] rounded-[50%] border border-[#e1a763]/35 bg-[#85664d]/36 shadow-[0_30px_90px_rgba(0,0,0,0.4)]" />
            <div className="absolute top-[418px] h-[68px] w-[720px] rounded-[50%] bg-[#f5b75e]/18 blur-md" />
            <div className="relative z-10 w-full max-w-[820px] pb-8">
              <p className="mb-4 text-center text-sm text-[#ffe0ad]/78">{copy.productHint}</p>
              <div className="grid grid-cols-3 gap-3">
                {INPUT_MODES.map((mode) => {
                  const active = activeInputMode === mode;
                  const modeCopy = copy.modes[mode];
                  return (
                    <button
                      key={mode}
                      type="button"
                      disabled={analyzing}
                      onClick={() => setActiveInputMode(mode)}
                      className={`relative min-h-[86px] rounded-[20px] border px-5 py-4 text-left transition ${
                        active
                          ? "border-[#ffd083] bg-[#4e382f]/92 text-[#fff1d5] shadow-[0_0_34px_rgba(255,194,103,0.38)]"
                          : "border-[#d7a66d]/40 bg-[#211c27]/74 text-[#d6bd9f] hover:border-[#ffd083]/70 hover:bg-[#302737]"
                      } ${analyzing ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                    >
                      <span className="block text-base font-semibold leading-tight">{modeCopy.title}</span>
                      <span className="mt-1 block text-xs leading-snug text-current/70">{modeCopy.desc}</span>
                    </button>
                  );
                })}
              </div>

              {activeInputMode && (
                <div className="mt-4 rounded-[24px] border border-[#d0a06c]/44 bg-[#211b25]/84 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_58px_rgba(0,0,0,0.28)] backdrop-blur">
                  {activeInputMode === "examples" && (
                    <div>
                      <div className="mb-3 flex items-end justify-between gap-4">
                        <div>
                          <h2 className="text-lg font-semibold text-[#ffe7c4]">{copy.examplesTitle}</h2>
                          <p className="mt-1 text-xs text-[#c9ad91]">{copy.examplesDesc}</p>
                        </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-1">
                        {audioCatalog.map((item) => (
                          <CatalogItemCard
                            key={item.id}
                            item={item}
                            disabled={analyzing}
                            onSelect={handleCatalogSelect}
                            copy={copy}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {activeInputMode === "search" && (
                    <div>
                      <input
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        disabled={analyzing}
                        placeholder={copy.searchPlaceholder}
                        className="h-12 w-full rounded-full border border-[#d0a06c]/45 bg-[#16121d]/86 px-5 text-sm text-[#ffe8c8] outline-none transition placeholder:text-[#b39678] focus:border-[#ffd083]"
                      />
                      <div className="mt-3 grid gap-3">
                        {visibleCatalog.length > 0 ? (
                          visibleCatalog.map((item) => (
                            <CatalogItemCard
                              key={item.id}
                              item={item}
                              disabled={analyzing}
                              onSelect={handleCatalogSelect}
                              copy={copy}
                            />
                          ))
                        ) : (
                          <div className="rounded-[18px] border border-[#d0a06c]/28 bg-[#18131f]/70 px-4 py-5 text-center text-sm text-[#ccb092]">
                            {copy.searchEmpty}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeInputMode === "upload" && (
                    <div>
                      <p className="mb-3 text-center text-sm text-[#ffe0ad]/80">{copy.uploadTitle}</p>
                      <AudioUploader onFileSelect={(file) => handleFileSelect(file)} disabled={analyzing} language={language} />
                    </div>
                  )}
                </div>
              )}

              {error && <p className="mt-3 text-center text-sm text-[#ffd2c7]">{error}</p>}
            </div>
          </div>
        </section>

        {analyzing && (
          <div className="fixed bottom-8 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full border border-[#f0bc72]/35 bg-[#1d1825]/86 px-5 py-3 text-sm text-[#ffe0b1] shadow-[0_14px_48px_rgba(0,0,0,0.35)] backdrop-blur">
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>{copy.analyzing}</span>
          </div>
        )}
      </div>
    </main>
  );
}

function CatalogItemCard({
  item,
  disabled,
  onSelect,
  copy,
}: {
  item: AudioCatalogItem;
  disabled: boolean;
  onSelect: (item: AudioCatalogItem) => void;
  copy: typeof COPY.zh | typeof COPY.en;
}) {
  return (
    <div className="grid gap-3 rounded-[18px] border border-[#d0a06c]/36 bg-[#18131f]/72 p-4 md:grid-cols-[1fr_190px] md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-[#ffe7c4]">{item.name}</h3>
          <span className="rounded-full border border-[#d0a06c]/35 px-2 py-0.5 text-[11px] text-[#d7b58f]">
            {formatDuration(item.durationSeconds, copy.seconds)}
          </span>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-[#c9ad91]">{item.description}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {item.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-[#f0bc72]/12 px-2 py-0.5 text-[11px] text-[#f3c98e]">
              {tag}
            </span>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-[#9f866c]">
          {copy.source}: {item.source} · {copy.license}: {item.license}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <audio controls preload="metadata" src={item.file} className="h-9 w-full" aria-label={`${copy.preview} ${item.name}`} />
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelect(item)}
          className={`h-11 rounded-full border text-sm font-semibold transition ${
            disabled
              ? "cursor-not-allowed border-[#d0a06c]/25 bg-[#2b2430]/65 text-[#b99b78]"
              : "cursor-pointer border-[#ffd083] bg-[#ffd083] text-[#2c2028] shadow-[0_0_24px_rgba(255,194,103,0.32)] hover:bg-[#ffe0a6]"
          }`}
        >
          {copy.startWithThis}
        </button>
      </div>
    </div>
  );
}
