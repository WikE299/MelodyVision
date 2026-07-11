"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import FlowHeader from "@/components/FlowHeader";
import {
  Character,
  chineseCharacters,
  getCharactersByIds,
  westernCharacters,
} from "@/lib/characters";
import { characterUi, type Language, useLanguage } from "@/lib/i18n";

const DEFAULT_COMBO = ["boya", "beethoven", "abing", "armstrong"];
const MAX_SELECTION = 4;

const COPY = {
  zh: {
    commentFailed: "聆听室初始化失败，请稍后重试",
    eyebrow: "✦ 选择你的聆听导览者 ✦",
    title: "选择你的聆听导览者",
    subtitle: "可多选 1-4 位",
    selected: "已选择",
    maxSelected: "最多可选 4 位",
    clear: "清空选择",
    defaultCombo: "推荐组合",
    defaultNames: "伯牙 + 贝多芬 + 阿炳 + 阿姆斯特朗",
    empty: "请选择至少一位音乐家",
    entering: "正在进入...",
    enter: "进入聆听室",
    helper: "进入后可调整角色并开始聆听",
    generating: "正在安排第一轮共同聆听，完成后会自动进入聆听页",
  },
  en: {
    commentFailed: "Failed to initialize the listening room. Please try again later.",
    eyebrow: "✦ Choose Your Listening Guides ✦",
    title: "Choose Your Listening Guides",
    subtitle: "Select 1-4 musicians",
    selected: "Selected",
    maxSelected: "Up to 4 guides",
    clear: "Clear",
    defaultCombo: "Preset",
    defaultNames: "Boya · Beethoven · A Bing · Armstrong",
    empty: "Choose at least one musician",
    entering: "Entering...",
    enter: "Enter Listening Room",
    helper: "You can listen and adjust the cast on the next page",
    generating: "Preparing the first listening round. The room will open soon.",
  },
};

const GUIDE_ORDER = [
  "boya",
  "jikang",
  "caiwenji",
  "abing",
  "tandun",
  "bach",
  "mozart",
  "beethoven",
  "armstrong",
  "lennon",
];

const FIGURE_STYLE: Record<string, string> = {
  boya: "w-[clamp(136px,10.2vw,172px)] -translate-y-1",
  jikang: "w-[clamp(132px,10vw,168px)]",
  caiwenji: "w-[clamp(130px,9.8vw,164px)] -translate-y-2",
  abing: "w-[clamp(132px,9.9vw,166px)] -translate-y-1",
  tandun: "w-[clamp(126px,9.4vw,158px)] translate-y-1",
  bach: "w-[clamp(138px,10.4vw,174px)] translate-y-1",
  mozart: "w-[clamp(140px,10.5vw,176px)] translate-y-1",
  beethoven: "w-[clamp(136px,10.2vw,172px)] -translate-y-1",
  armstrong: "w-[clamp(132px,10vw,168px)]",
  lennon: "w-[clamp(130px,9.8vw,164px)] translate-y-2",
};

function CharacterFigure({
  character,
  selected,
  disabled,
  onClick,
  language,
}: {
  character: Character;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  language: Language;
}) {
  const label = characterUi[language][character.id as keyof typeof characterUi.zh] || {
    name: character.name,
    era: character.era,
    focus: character.focusDescription,
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group relative flex h-[clamp(328px,45vh,430px)] w-[clamp(104px,8.6vw,144px)] shrink-0 flex-col items-center justify-end transition duration-300 ${
        disabled ? "cursor-not-allowed opacity-55" : "cursor-pointer"
      }`}
      aria-pressed={selected}
    >
      <div
        className={`absolute bottom-[clamp(96px,13.2vh,124px)] h-[clamp(64px,9vh,86px)] w-[clamp(104px,8vw,134px)] rounded-[50%] border transition duration-300 ${
          selected
            ? "border-[#ffd178]/95 bg-[#ffc15f]/28 shadow-[0_0_38px_rgba(255,193,95,0.9)]"
            : "border-[#8b644a]/44 bg-black/22 shadow-[0_24px_44px_rgba(0,0,0,0.34)] group-hover:border-[#d89d58]/80 group-hover:bg-[#ffc15f]/14"
        }`}
      />
      <div className="absolute bottom-[clamp(103px,14.1vh,134px)] h-10 w-[clamp(96px,7.4vw,124px)] rounded-[50%] bg-[#f6b45e]/12 blur-md transition duration-300 group-hover:bg-[#f6b45e]/28" />
      <div
        className={`relative z-10 mb-[clamp(112px,15.2vh,140px)] flex h-[clamp(170px,23vh,218px)] items-end justify-center transition duration-300 ${
          selected
            ? "scale-[1.06] drop-shadow-[0_0_20px_rgba(255,222,151,0.72)] drop-shadow-[0_28px_20px_rgba(0,0,0,0.38)]"
            : "drop-shadow-[0_22px_24px_rgba(0,0,0,0.46)] group-hover:scale-[1.035] group-hover:drop-shadow-[0_0_18px_rgba(255,208,133,0.45)]"
        }`}
      >
        <Image
          src={`/characters/stage/${character.id}.png`}
          alt={label.name}
          width={512}
          height={512}
          className={`h-auto max-h-[clamp(178px,24vh,230px)] object-contain [filter:drop-shadow(0_0_1px_rgba(62,38,22,0.55))_drop-shadow(0_8px_13px_rgba(0,0,0,0.34))_drop-shadow(0_0_11px_rgba(239,171,91,0.2))] ${FIGURE_STYLE[character.id] || "w-[clamp(132px,9.9vw,166px)]"}`}
        />
      </div>
      <div
        className={`absolute bottom-[-83px] flex h-[clamp(198px,25vh,238px)] w-full flex-col items-center rounded-[clamp(16px,1.45vw,24px)] border px-2 pt-[clamp(52px,7.4vh,76px)] text-center transition duration-300 ${
          selected
            ? "border-[#ffd178]/70 bg-[#815b3f]/42 shadow-[0_0_40px_rgba(255,190,92,0.33)]"
            : "border-[#a37b58]/28 bg-[#5a463f]/28 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] group-hover:border-[#d59a5f]/48 group-hover:bg-[#694d3d]/38"
        }`}
      >
        {selected && (
          <div className="absolute -top-4 flex h-9 w-9 items-center justify-center rounded-full border border-[#ffe1a3] bg-[#313148] text-[#ffe1a3] shadow-[0_0_20px_rgba(255,207,117,0.72)]">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="m5 13 4 4L19 7" />
            </svg>
          </div>
        )}
        <p className="text-[clamp(14px,1.05vw,18px)] font-semibold text-[#ffe6c3]">{label.name}</p>
        <p className="mt-0.5 text-[clamp(11px,0.82vw,14px)] text-[#f2d0aa]/88">{label.era}</p>
      </div>
    </button>
  );
}

export default function SelectPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const copy = COPY[language];
  const [selected, setSelected] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const guides = useMemo(() => {
    const allCharacters = [...chineseCharacters, ...westernCharacters];
    return GUIDE_ORDER.map((id) => allCharacters.find((character) => character.id === id)).filter(Boolean) as Character[];
  }, []);

  const selectedCharacters = getCharactersByIds(selected);

  const toggleCharacter = (id: string) => {
    if (generating) return;
    setSelected((prev) => {
      if (prev.includes(id)) {
        return prev.filter((characterId) => characterId !== id);
      }
      if (prev.length >= MAX_SELECTION) return prev;
      return [...prev, id];
    });
  };

  const applyDefaultCombo = () => {
    if (generating) return;
    setSelected(DEFAULT_COMBO);
  };

  const clearSelection = () => {
    if (generating) return;
    setSelected([]);
  };

  const handleContinue = async () => {
    if (selected.length === 0 || generating) return;

    setGenerating(true);
    setError("");
    sessionStorage.setItem("selectedCharacters", JSON.stringify(selected));
    sessionStorage.setItem("comments", "{}");
    sessionStorage.removeItem("conversationState");
    sessionStorage.removeItem("facilitatorPlan");

    try {
      const sessionId = sessionStorage.getItem("experimentSessionId") || crypto.randomUUID();
      const musicProfile = JSON.parse(sessionStorage.getItem("musicProfile") || "null") as { id?: string } | null;
      const musicProfileId = musicProfile?.id || `degraded-${sessionId}`;
      sessionStorage.setItem("experimentSessionId", sessionId);

      const conversationResponse = await fetch("/api/conversation/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          musicProfileId,
          selectedMusicianIds: selected,
          preparedSummaries: {},
        }),
      });
      if (!conversationResponse.ok) throw new Error("Conversation initialization failed");
      const conversation = await conversationResponse.json();
      sessionStorage.setItem("conversationState", JSON.stringify(conversation.state));
      sessionStorage.setItem("facilitatorPlan", JSON.stringify(conversation.facilitatorPlan));
      router.push("/listen");
    } catch {
      setError(copy.commentFailed);
      setGenerating(false);
    }
  };

  return (
    <main className="relative h-screen overflow-hidden bg-[#15111c] text-[#f8dfbb]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_85%,rgba(255,183,92,0.16),transparent_20%),linear-gradient(135deg,#1d1928_0%,#332a39_45%,#14131d_100%)]" />
      <div className="absolute inset-0 opacity-45 [background-image:linear-gradient(115deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(25deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:180px_180px,220px_220px]" />

      <div className="relative z-10 flex h-screen flex-col px-4 py-3 lg:px-6 lg:py-4 2xl:px-14 2xl:py-6">
        <FlowHeader activeStep={2} />

        <section className="relative mt-3 flex flex-1 flex-col overflow-hidden rounded-[22px] border border-[#9f6f45]/55 bg-[#251f2b]/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] 2xl:mt-5 2xl:rounded-[26px]">
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(19,17,28,0.06),rgba(20,17,25,0.32))]" />
            <div className="absolute left-[3%] right-[3%] top-[29%] flex h-12 items-end justify-center gap-1 opacity-52">
              {Array.from({ length: 180 }).map((_, index) => (
                <span
                  key={index}
                  className="w-1 rounded-full bg-[#d9963f]"
                  style={{
                    height: `${(4 + Math.abs(Math.sin(index * 0.18)) * 36).toFixed(2)}px`,
                    opacity: (0.18 + Math.abs(Math.sin(index * 0.21)) * 0.42).toFixed(3),
                  }}
                />
              ))}
            </div>
            {["♪", "♫", "♪", "♬", "♪", "♫"].map((note, index) => (
              <span
                key={`${note}-${index}`}
                className="absolute text-4xl text-[#eaa957]/55"
                style={{
                  left: `${8 + index * 16}%`,
                  top: `${12 + (index % 3) * 10}%`,
                }}
              >
                {note}
              </span>
            ))}
            <div className="absolute bottom-0 left-1/2 h-[260px] w-[1450px] -translate-x-1/2 rounded-[50%] border border-[#b88552]/30 bg-[#765d4c]/22 shadow-[0_24px_90px_rgba(0,0,0,0.38)]" />
            <div className="absolute bottom-[-66px] left-1/2 h-[210px] w-[1260px] -translate-x-1/2 rounded-[50%] border border-[#b88552]/25 bg-[#6a5147]/35" />
            <div className="absolute bottom-[58px] left-[5%] h-24 w-24 rotate-45 border border-[#e5a760]/16 bg-black/16" />
            <div className="absolute right-[6%] top-[28%] h-20 w-20 rotate-12 border border-[#e5a760]/16 bg-[#e5a760]/8" />
          </div>

          <div className="relative z-10 flex min-h-0 flex-1 flex-col px-4 pt-3 lg:px-5 2xl:px-8 2xl:pt-7">
            <div className="text-center">
              <p className="text-xs tracking-[0.3em] text-[#f8c875]/78 2xl:text-sm 2xl:tracking-[0.34em]">{copy.eyebrow}</p>
              <h2 className="mt-1 font-serif text-[clamp(28px,2.4vw,36px)] font-semibold tracking-wide text-[#ffe5c1] drop-shadow-[0_4px_18px_rgba(0,0,0,0.45)] 2xl:mt-2">
                {copy.title}
              </h2>
              <p className="mt-1 text-sm text-[#f8d8af]/88 2xl:mt-2 2xl:text-base">{copy.subtitle}</p>
            </div>

            <div className="relative -mt-2 flex min-h-0 flex-1 translate-y-[-90px] items-end justify-center 2xl:translate-y-[-98px]">
              <div className="flex w-full max-w-[min(1450px,calc(100vw-72px))] items-end justify-between gap-0.5 2xl:gap-1">
                {guides.map((character) => (
                  <CharacterFigure
                    key={character.id}
                    character={character}
                    selected={selected.includes(character.id)}
                    disabled={generating}
                    onClick={() => toggleCharacter(character.id)}
                    language={language}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="relative z-20 flex items-center justify-center px-4 pb-3 2xl:px-8 2xl:pb-5">
            <div className="grid w-full max-w-[min(1370px,calc(100vw-128px))] grid-cols-[minmax(520px,1.25fr)_minmax(170px,0.75fr)_minmax(220px,280px)] items-center gap-3 rounded-[22px] border border-[#d7b18a]/42 bg-[#d7c0aa]/72 px-5 py-3 text-[#302536] shadow-[0_18px_55px_rgba(0,0,0,0.26)] backdrop-blur 2xl:grid-cols-[1.15fr_1.18fr_320px] 2xl:gap-6 2xl:rounded-[28px] 2xl:px-8 2xl:py-4">
              <div className="flex items-center gap-3 2xl:gap-6">
                <div>
                  <p className="whitespace-nowrap text-xl font-semibold 2xl:text-2xl">{copy.selected} {selected.length} / {MAX_SELECTION}</p>
                  <p className="mt-0.5 text-xs text-[#5f5361] 2xl:mt-1 2xl:text-sm">{copy.maxSelected}</p>
                </div>
                <button
                  type="button"
                  onClick={clearSelection}
                  disabled={selected.length === 0 || generating}
                  className="flex items-center gap-2 whitespace-nowrap border-l border-[#9e8976]/50 pl-4 text-base transition hover:text-[#7b4c20] disabled:cursor-not-allowed disabled:opacity-45 2xl:gap-3 2xl:pl-7 2xl:text-lg"
                >
                  <span className="text-2xl 2xl:text-3xl">↻</span>
                  {copy.clear}
                </button>
                <div className="flex min-w-0 items-center gap-2 border-l border-[#9e8976]/50 pl-3 2xl:gap-3 2xl:pl-6">
                  <button
                    type="button"
                    onClick={applyDefaultCombo}
                    disabled={generating}
                    className="flex items-center gap-2 whitespace-nowrap text-base transition hover:text-[#7b4c20] disabled:cursor-not-allowed disabled:opacity-45 2xl:gap-3 2xl:text-lg"
                  >
                    <span className="text-2xl 2xl:text-3xl">☆</span>
                    {copy.defaultCombo}
                  </button>
                  <span className="max-w-[clamp(148px,16vw,240px)] truncate whitespace-nowrap text-xs text-[#6b5b59] 2xl:max-w-none 2xl:text-sm">
                    {copy.defaultNames}
                  </span>
                </div>
              </div>

              <div className="flex min-h-[62px] items-center justify-center gap-3 2xl:min-h-[88px] 2xl:gap-4">
                {selectedCharacters.length === 0 ? (
                  <p className="text-base text-[#6d6170]">{copy.empty}</p>
                ) : (
                  selectedCharacters.map((character) => (
                    <div key={character.id} className="relative flex w-20 flex-col items-center">
                      <button
                        type="button"
                        onClick={() => toggleCharacter(character.id)}
                        disabled={generating}
                        className="absolute -right-1 -top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-[#8b6c52] bg-[#f6e0c8] text-sm text-[#3a2b28] shadow"
                      >
                        ×
                      </button>
                      <div className="relative h-12 w-12 overflow-hidden rounded-xl bg-[#b89576]/44 2xl:h-16 2xl:w-16 2xl:rounded-2xl">
                        <Image
                          src={`/characters/stage/${character.id}.png`}
                          alt={characterUi[language][character.id as keyof typeof characterUi.zh]?.name || character.name}
                          fill
                          className="object-contain p-1"
                        />
                      </div>
                      <span className="mt-1 max-w-20 truncate text-xs 2xl:text-sm">
                        {characterUi[language][character.id as keyof typeof characterUi.zh]?.name || character.name}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="flex flex-col items-stretch gap-2">
                <button
                  type="button"
                  onClick={handleContinue}
                  disabled={selected.length === 0 || generating}
                  className={`flex h-14 items-center justify-between rounded-2xl border px-5 text-base font-semibold transition 2xl:h-20 2xl:px-8 2xl:text-xl ${
                    selected.length > 0 && !generating
                      ? "border-[#f9c979] bg-[#2c2435] text-[#ffe4b7] shadow-[0_0_28px_rgba(255,188,92,0.5)] hover:bg-[#362b3f]"
                      : "border-[#bba28b] bg-[#8c7d73]/42 text-[#756a68] cursor-not-allowed"
                  }`}
                >
                  <span>{generating ? copy.entering : copy.enter}</span>
                  <span className="text-2xl 2xl:text-3xl">→</span>
                </button>
                <p className="text-center text-xs text-[#6a5b5a]">{copy.helper}</p>
              </div>
            </div>
          </div>

          {(generating || error) && (
            <div className="absolute bottom-28 left-1/2 z-30 -translate-x-1/2 rounded-full border border-[#f0bc72]/35 bg-[#1d1825]/88 px-5 py-3 text-sm text-[#ffe0b1] shadow-[0_14px_48px_rgba(0,0,0,0.35)] backdrop-blur">
              {generating ? copy.generating : error}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
