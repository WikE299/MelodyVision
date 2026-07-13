"use client";

import { useLanguage } from "@/lib/i18n";

type FlowStep = {
  index: string;
  title: {
    zh: string;
    en: string;
  };
  icon: string;
};

const STEPS: FlowStep[] = [
  { index: "01", title: { zh: "音乐输入", en: "Music Input" }, icon: "note" },
  { index: "02", title: { zh: "选择导览", en: "Choose Guides" }, icon: "guides" },
  { index: "03", title: { zh: "共创聆听", en: "Co-create" }, icon: "ear" },
  { index: "04", title: { zh: "画作呈现", en: "Artwork" }, icon: "image" },
];

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

export default function FlowHeader({
  activeStep,
  variant = "dark",
  brandLabel = "MelodyVision",
  compact = false,
}: {
  activeStep: 1 | 2 | 3 | 4;
  variant?: "dark" | "light";
  brandLabel?: string;
  compact?: boolean;
}) {
  const isDark = variant === "dark";
  const { language, toggleLanguage } = useLanguage();

  return (
    <header className={`flex justify-between gap-4 lg:gap-6 2xl:gap-8 ${compact ? "h-14 items-center" : "items-start"}`}>
      <div className={compact ? "min-w-[190px]" : "min-w-[210px] 2xl:min-w-[290px]"}>
        <h1
          className={`font-serif leading-none tracking-tight drop-shadow-[0_3px_18px_rgba(255,194,119,0.16)] ${compact ? "text-2xl" : "text-3xl 2xl:text-4xl"} ${
            isDark ? "text-[#ffe4bd]" : "text-[#2f2638]"
          }`}
        >
          {brandLabel} <span className={`${compact ? "text-lg" : "text-2xl"} text-[#f3b862]`}>✦</span>
        </h1>
        {!compact && (
          <p className={`mt-2 text-lg font-medium 2xl:mt-3 2xl:text-xl ${isDark ? "text-[#ffe7c6]" : "text-[#6c5d68]"}`}>
            {language === "zh" ? "音乐画师 · 当音乐作画" : "Music Painter · When Music Paints"}
          </p>
        )}
      </div>

      <nav className={`hidden flex-1 justify-center xl:flex ${compact ? "items-center gap-2" : "items-start gap-2 2xl:gap-6"}`}>
        {STEPS.map((step, index) => {
          const active = activeStep === index + 1;
          return (
            <div key={step.index} className={`flex gap-2 ${compact ? "items-center" : "items-start 2xl:gap-6"}`}>
              <div className={`flex items-start gap-2 ${compact ? "min-w-[96px]" : "min-w-[104px] 2xl:min-w-[146px] 2xl:gap-3"}`}>
                <div
                  className={`flex shrink-0 items-center justify-center rounded-full border ${compact ? "h-9 w-9" : "h-11 w-11 2xl:h-14 2xl:w-14"} ${
                    active
                      ? "border-[#f8bf6a] bg-[#4a342b] text-[#ffd789] shadow-[0_0_24px_rgba(255,184,83,0.55)]"
                      : isDark
                        ? "border-[#b18b72]/45 bg-white/5 text-[#ccb49d]"
                        : "border-[#c8b7a8] bg-white text-[#9a8371]"
                  }`}
                >
                  <StepIcon type={step.icon} />
                </div>
                <div>
                  <p className={`${compact ? "text-base" : "text-xl 2xl:text-2xl"} ${active ? "text-[#ffd385]" : isDark ? "text-[#d8bf9e]" : "text-[#6b5c67]"}`}>
                    {step.index}
                  </p>
                  <p className={`${compact ? "mt-0 text-[11px]" : "mt-1 text-[13px] 2xl:text-sm"} whitespace-nowrap leading-tight ${isDark ? "text-[#f3d5ad]" : "text-[#756674]"}`}>
                    {step.title[language]}
                  </p>
                </div>
              </div>
              {index < STEPS.length - 1 && (
                <div className={`${compact ? "text-lg" : "pt-4 text-xl 2xl:pt-5 2xl:text-3xl"} ${isDark ? "text-[#d5aa79]/85" : "text-[#b99a78]"}`}>→</div>
              )}
            </div>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={toggleLanguage}
        className={`shrink-0 rounded-full border px-3 text-sm font-semibold transition 2xl:px-4 ${compact ? "py-1.5" : "py-2"} ${
          isDark
            ? "border-[#b18b72]/50 bg-white/5 text-[#ffe3bd] hover:border-[#ffd083]/80 hover:bg-[#3a2d32]"
            : "border-[#c8b7a8] bg-white text-[#5d5060] hover:border-[#9f6f45]"
        }`}
        aria-label={language === "zh" ? "Switch to English" : "切换到中文"}
      >
        {language === "zh" ? "ZH / EN" : "EN / ZH"}
      </button>
    </header>
  );
}
