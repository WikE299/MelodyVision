"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import AudioUploader from "@/components/AudioUploader";
import { analyzeAudioFile } from "@/lib/audio/web-analyzer";

const STEPS = [
  { index: "01", title: { zh: "音乐输入", en: "Music Input" }, icon: "note", active: true },
  { index: "02", title: { zh: "选择导览", en: "Listening Guides" }, icon: "guides" },
  { index: "03", title: { zh: "聆听与点评", en: "Listening Room" }, icon: "ear" },
  { index: "04", title: { zh: "策展生成", en: "Curate & Generate" }, icon: "palette" },
  { index: "05", title: { zh: "画作呈现", en: "Gallery Result" }, icon: "image" },
];

const COPY = {
  zh: {
    brandSubtitle: "音乐画师 · 当音乐作画",
    heroTitle: "MelodyVision",
    heroSubtitle: "音乐画师 · 当音乐作画",
    heroBody: "上传一首曲子，让古今中外的音乐家陪你一起听，再生成一幅画。",
    help: "如何使用",
    analyzing: "正在分析音乐...",
    switchLanguage: "EN",
  },
  en: {
    brandSubtitle: "Music to Image, Through Human Listening",
    heroTitle: "MelodyVision",
    heroSubtitle: "Music to Image, Through Human Listening",
    heroBody: "Upload a track. Hear from cross-cultural musicians. Create an artwork.",
    help: "How it works",
    analyzing: "Analyzing music...",
    switchLanguage: "中",
  },
};

function StepIcon({ type }: { type: string }) {
  if (type === "guides") {
    return (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 11a4 4 0 1 1 8 0M5 20a7 7 0 0 1 14 0M17 8a3 3 0 0 1 2 5.24M7 8a3 3 0 0 0-2 5.24" />
      </svg>
    );
  }
  if (type === "ear") {
    return (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.5 10.5a3.5 3.5 0 1 1 6.3 2.1c-.72 1.04-1.75 1.43-2.45 2.14-.48.49-.72 1.03-.72 1.76A2.5 2.5 0 0 1 9.12 19M5.5 10.5a6.5 6.5 0 1 1 11.3 4.4" />
      </svg>
    );
  }
  if (type === "palette") {
    return (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4a8 8 0 0 0 0 16h1.2a1.8 1.8 0 0 0 1.08-3.24 1.2 1.2 0 0 1 .72-2.16H16a4 4 0 0 0 0-8h-.5M8 10h.01M11 8h.01M15 9h.01" />
      </svg>
    );
  }
  if (type === "image") {
    return (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 6h14v12H5zM8 15l3-3 2 2 2-3 3 4M8.5 9h.01" />
      </svg>
    );
  }
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 18V6l10-2v12M9 18c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2Zm10-2c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2Z" />
    </svg>
  );
}

interface HomePageClientProps {
  initialLanguage: "zh" | "en";
}

export default function HomePageClient({ initialLanguage }: HomePageClientProps) {
  const router = useRouter();
  const [analyzing, setAnalyzing] = useState(false);
  const [language] = useState<"zh" | "en">(initialLanguage);
  const copy = COPY[language];
  const nextLanguage = language === "zh" ? "en" : "zh";

  const handleFileSelect = async (file: File) => {
    setAnalyzing(true);

    // Store file info in sessionStorage for the flow
    sessionStorage.setItem("audioFileName", file.name);
    sessionStorage.setItem("audioFileSize", String(file.size));
    sessionStorage.removeItem("audioSrc");

    // Create object URL for later use
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
      spectralCentroid: features.spectralCentroid,
      spectralFlatness: features.spectralFlatness,
      spectralRolloff: features.spectralRolloff,
    };
    sessionStorage.setItem("musicAnalysis", JSON.stringify(analysis));

    router.push("/select");
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#15111c] text-[#f8dfbb]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_52%,rgba(255,176,86,0.28),transparent_26%),radial-gradient(circle_at_18%_85%,rgba(255,183,92,0.2),transparent_20%),linear-gradient(135deg,#191526_0%,#302638_44%,#12111b_100%)]" />
      <div className="absolute inset-0 opacity-45 [background-image:linear-gradient(115deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(25deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:180px_180px,220px_220px]" />
      <div className="absolute left-[6%] top-[20%] h-24 w-24 rotate-45 border border-white/8 bg-white/5" />
      <div className="absolute right-[4%] top-[18%] h-32 w-32 rotate-12 border border-white/8 bg-white/5" />
      <div className="absolute bottom-[9%] left-[3%] h-28 w-28 rotate-12 border border-white/8 bg-black/20" />

      <div className="relative z-10 flex min-h-screen flex-col px-8 py-8 2xl:px-14">
        <header className="flex items-start justify-between gap-8">
          <div className="min-w-[290px]">
            <h1 className="font-serif text-4xl leading-none tracking-tight text-[#ffe4bd] drop-shadow-[0_3px_18px_rgba(255,194,119,0.16)]">
              MelodyVision <span className="text-2xl text-[#f3b862]">✦</span>
            </h1>
            <p className="mt-3 text-xl font-medium text-[#ffe7c6]">{copy.brandSubtitle}</p>
          </div>

          <nav className="hidden flex-1 items-start justify-center gap-6 xl:flex">
            {STEPS.map((step, index) => (
              <div key={step.index} className="flex items-start gap-6">
                <div className="flex min-w-[128px] items-start gap-3">
                  <div
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full border ${
                      step.active
                        ? "border-[#f8bf6a] bg-[#4a342b] text-[#ffd789] shadow-[0_0_24px_rgba(255,184,83,0.55)]"
                        : "border-[#b18b72]/45 bg-white/5 text-[#ccb49d]"
                    }`}
                  >
                    <StepIcon type={step.icon} />
                  </div>
                  <div>
                    <p className={`text-2xl ${step.active ? "text-[#ffd385]" : "text-[#d8bf9e]"}`}>{step.index}</p>
                    <p className="mt-1 max-w-[108px] text-sm leading-tight text-[#f3d5ad]">{step.title[language]}</p>
                  </div>
                </div>
                {index < STEPS.length - 1 && <div className="pt-5 text-3xl text-[#d5aa79]/85">→</div>}
              </div>
            ))}
          </nav>

          <div className="flex min-w-[160px] items-center justify-end gap-4 text-sm text-white/86">
            <a
              href={`/?lang=${nextLanguage}`}
              onClick={() => localStorage.setItem("melodyvisionLanguage", nextLanguage)}
              className="rounded-full border border-[#c99b62]/70 px-4 py-2 text-[#ffe1ae] transition-colors hover:bg-[#f0b765]/12"
            >
              {copy.switchLanguage}
            </a>
            <button className="flex h-12 w-12 items-center justify-center rounded-full border border-[#c99b62] text-lg text-[#ffe1ae]">
              N
            </button>
            <span className="text-[#d8b17d]">⌄</span>
          </div>
        </header>

        <section className="relative mt-6 flex flex-1 items-center justify-center rounded-[42px] border border-[#9f6f45]/75 bg-[#261f2a]/45 px-10 py-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <div className="absolute inset-0 overflow-hidden rounded-[42px]">
            <div className="absolute left-0 right-0 top-[44%] h-px bg-[#f0b45e]/20" />
            <div className="absolute left-[23%] right-[16%] top-[46%] flex h-28 items-end justify-center gap-1 opacity-80">
              {Array.from({ length: 90 }).map((_, index) => (
                <span
                  key={index}
                  className="w-1 rounded-full bg-[#ffc268]"
                  style={{ height: `${12 + Math.abs(Math.sin(index * 0.18)) * 70}px`, opacity: 0.25 + Math.abs(Math.sin(index * 0.24)) * 0.65 }}
                />
              ))}
            </div>
            {["♪", "♫", "♪", "♬", "♪"].map((note, index) => (
              <span
                key={`${note}-${index}`}
                className="absolute text-4xl text-[#eaa957]/70"
                style={{
                  left: `${12 + index * 18}%`,
                  top: `${18 + (index % 2) * 18}%`,
                }}
              >
                {note}
              </span>
            ))}
          </div>

          <div className="relative grid w-full max-w-[1420px] grid-cols-[minmax(390px,0.95fr)_minmax(620px,1.35fr)] items-center gap-12">
            <div className="pl-8">
              <h2 className="font-serif text-7xl leading-none tracking-tight text-[#ffe4bd] drop-shadow-[0_7px_24px_rgba(18,12,20,0.5)]">
                {copy.heroTitle}
              </h2>
              <p className="mt-7 max-w-xl text-3xl leading-tight text-[#ffe8cc]">{copy.heroSubtitle}</p>
              <div className="mt-6 h-px w-72 bg-[#d8a766]/80" />
              <p className="mt-6 max-w-md text-lg leading-8 text-white/82">
                {copy.heroBody}
              </p>
              <button className="mt-8 flex items-center gap-3 text-base text-[#ffe0ad]">
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#b88755] bg-black/12">▶</span>
                {copy.help}
              </button>
            </div>

            <div className="relative flex min-h-[560px] flex-col items-center justify-end pr-8">
              <div className="absolute top-0 h-[420px] w-[520px] rounded-full bg-[#ffbd68]/16 blur-3xl" />
              <div className="absolute top-3 w-[600px] opacity-95 mix-blend-screen [mask-image:radial-gradient(ellipse_at_center,black_48%,rgba(0,0,0,0.76)_58%,transparent_80%)]">
                <Image
                  src="/crystal-stage.png"
                  alt=""
                  width={560}
                  height={440}
                  priority
                  className="h-auto w-full"
                />
              </div>
              <div className="absolute top-[306px] h-[118px] w-[660px] rounded-[50%] border border-[#e1a763]/45 bg-[#85664d]/45 shadow-[0_22px_80px_rgba(0,0,0,0.42)]" />
              <div className="absolute top-[348px] h-[54px] w-[600px] rounded-[50%] bg-[#f5b75e]/18 blur-sm" />
              <div className="relative z-10 w-full max-w-[660px]">
                <AudioUploader onFileSelect={handleFileSelect} disabled={analyzing} language={language} />
              </div>
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
