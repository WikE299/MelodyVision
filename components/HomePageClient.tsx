"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import AudioUploader from "@/components/AudioUploader";
import FlowHeader from "@/components/FlowHeader";
import { analyzeAudioFile } from "@/lib/audio/web-analyzer";

const COPY = {
  uploadHint: "上传音乐，让音乐家评论生成图像。",
  analyzing: "正在分析音乐...",
};

export default function HomePageClient() {
  const router = useRouter();
  const [analyzing, setAnalyzing] = useState(false);

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
            <div className="relative z-10 w-full max-w-[650px] pb-12">
              <AudioUploader onFileSelect={handleFileSelect} disabled={analyzing} language="zh" />
              <p className="mt-4 text-center text-sm text-[#ffe0ad]/74">{COPY.uploadHint}</p>
            </div>
          </div>
        </section>

        {analyzing && (
          <div className="fixed bottom-8 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full border border-[#f0bc72]/35 bg-[#1d1825]/86 px-5 py-3 text-sm text-[#ffe0b1] shadow-[0_14px_48px_rgba(0,0,0,0.35)] backdrop-blur">
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>{COPY.analyzing}</span>
          </div>
        )}
      </div>
    </main>
  );
}
