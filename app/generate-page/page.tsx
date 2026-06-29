"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import FlowHeader from "@/components/FlowHeader";
import { getCharactersByIds, type Character } from "@/lib/characters";
import { getExperimentSessionId } from "@/lib/experiment-session";
import {
  VISUAL_PRESET_OPTIONS,
  type VisualPresets,
} from "@/lib/prompts/visual-presets";

type Presets = VisualPresets;

type MusicAnalysisView = {
  tempo?: string;
  energy?: string;
  brightness?: string;
  mood?: string;
  bpm?: number;
};

const initialPresets: Presets = {
  style: "自动",
  mood: "自动",
  tone: "自动",
};

const optionNames = {
  style: "视觉风格",
  mood: "情绪基调",
  tone: "色彩与光",
};

const presetMeta: Record<string, { hint: string }> = {
  自动: { hint: "根据内容自动判断" },
  水墨: { hint: "墨色、留白、渗化" },
  工笔: { hint: "精细线条与层染" },
  油画: { hint: "厚涂、肌理、光影" },
  印象派: { hint: "光色、笔触、空气感" },
  抽象: { hint: "形状、节奏、张力" },
  写实: { hint: "真实材质与空间" },
  宁静: { hint: "稳定、克制、留白" },
  激昂: { hint: "推进、冲撞、高张力" },
  忧伤: { hint: "距离、脆弱、消散" },
  欢快: { hint: "轻盈、明亮、跳动" },
  暖色: { hint: "琥珀、赭石、金色" },
  冷色: { hint: "蓝、青、银色" },
  淡雅: { hint: "低饱和、轻对比" },
  浓烈: { hint: "高饱和、强对比" },
};

const characterLabels: Record<string, { name: string; focus: string }> = {
  boya: { name: "伯牙", focus: "意" },
  jikang: { name: "嵇康", focus: "和" },
  caiwenji: { name: "蔡文姬", focus: "真" },
  abing: { name: "阿炳", focus: "苦" },
  tandun: { name: "谭盾", focus: "界" },
  bach: { name: "巴赫", focus: "序" },
  mozart: { name: "莫扎特", focus: "灵" },
  beethoven: { name: "贝多芬", focus: "力" },
  armstrong: { name: "阿姆斯特朗", focus: "活" },
  lennon: { name: "列侬", focus: "众" },
};

function normalizeText(value: unknown, fallback = "待分析") {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value);
}

function displayCharacter(character: Character) {
  return characterLabels[character.id] || { name: character.name, focus: character.focusKeyword };
}

function getInitialGenerateState() {
  if (typeof window === "undefined") {
    return {
      selectedCharacters: [] as string[],
      selectedChars: [] as Character[],
      comments: {} as Record<string, string>,
      userNote: "",
      musicAnalysis: {} as MusicAnalysisView,
    };
  }

  const selectedCharacters = JSON.parse(
    sessionStorage.getItem("selectedCharacters") || "[]"
  ) as string[];
  const comments = JSON.parse(sessionStorage.getItem("comments") || "{}") as Record<string, string>;
  const userNote = sessionStorage.getItem("userNote") || "";
  const musicAnalysis = JSON.parse(
    sessionStorage.getItem("musicAnalysis") || "{}"
  ) as MusicAnalysisView;

  return {
    selectedCharacters,
    selectedChars: getCharactersByIds(selectedCharacters),
    comments,
    userNote,
    musicAnalysis,
  };
}

function PresetCard({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const meta = presetMeta[label] || presetMeta["自动"];

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`group relative flex h-[62px] min-w-[156px] cursor-pointer items-center gap-3 rounded-[14px] border px-4 text-left transition duration-200 hover:-translate-y-0.5 ${
        active
          ? "border-[#ffd083] bg-[#4c372f] shadow-[0_0_28px_rgba(255,194,103,0.5)]"
          : "border-[#8f6b52]/50 bg-[#2c2631]/76 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-[#ffd083]/76 hover:bg-[#362b34]"
      } ${disabled ? "cursor-not-allowed opacity-55" : ""}`}
    >
      <div className="min-w-0 flex-1">
        <p className="whitespace-nowrap text-base font-semibold leading-tight text-[#ffe6c5]">{label}</p>
        <p className="mt-1 truncate text-[10px] text-[#cbb098]">{meta.hint}</p>
      </div>
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
          active ? "border-[#ffd083] bg-[#ffd083] text-[#382832]" : "border-[#d0a06c]/50 bg-[#211b25] text-[#d0a06c]"
        }`}
      >
        {active ? "✓" : ""}
      </span>
    </button>
  );
}

function PresetGroup({
  type,
  value,
  disabled,
  onChange,
}: {
  type: keyof Presets;
  value: string;
  disabled: boolean;
  onChange: (label: string) => void;
}) {
  const options = VISUAL_PRESET_OPTIONS[type].map((option) => option.label);

  return (
    <section className="min-w-0 rounded-[18px] border border-[#8f6b52]/42 bg-[#241f2a]/82 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <p className="text-base font-semibold text-[#ffe3bd]">{optionNames[type]}</p>
        <span className="text-xs text-[#c4a68b]">请选择一项</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-color:#9f6f45_transparent] [scrollbar-width:thin]">
        {options.map((label) => (
          <PresetCard
            key={label}
            label={label}
            active={value === label}
            disabled={disabled}
            onClick={() => onChange(label)}
          />
        ))}
      </div>
    </section>
  );
}

function PromptStructure({ presets, onClose }: { presets: Presets; onClose: () => void }) {
  const rows = [
    ["主体", presets.style === "自动" ? "由聆听输入决定" : `${presets.style}视觉主体`],
    ["动势", presets.mood === "激昂" ? "上升、冲撞、高张力" : presets.mood === "宁静" ? "缓慢、留白、稳定" : "由声音势能塑形"],
    ["情绪", presets.mood === "自动" ? "从点评中提取" : presets.mood],
    ["色彩", presets.tone === "自动" ? "匹配情绪基调" : `${presets.tone}色彩系统`],
    ["构图", "中心焦点 · 层次景深 · 留白"],
  ];

  return (
    <aside className="flex h-full min-h-0 w-[230px] shrink-0 flex-col rounded-[22px] border border-[#a77b57]/48 bg-[#241f2a]/68 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.24)] backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-[#ffe3bd]">画面结构</h3>
          <p className="mt-1 text-xs text-[#c7aa8d]">生成逻辑</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-[#a77b57]/42 px-2 py-1 text-xs text-[#d7b99b] hover:border-[#ffd083]/70"
        >
          收起
        </button>
      </div>
      <div className="mt-4 space-y-3">
        {rows.map(([title, content], index) => (
          <div key={title} className="rounded-[14px] border border-[#8f6b52]/34 bg-[#2d2732]/78 p-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[#d5a36b]/52 text-xs text-[#f4bd72]">
                {index + 1}
              </span>
              <p className="text-sm font-semibold text-[#ffe3bd]">{title}</p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[#cdb297]">{content}</p>
          </div>
        ))}
      </div>
      <p className="mt-auto rounded-full border border-[#a77b57]/38 px-4 py-3 text-center text-xs text-[#d7b99b]">
        最终画面将综合音乐、点评和你的选择
      </p>
    </aside>
  );
}

export default function GeneratePage() {
  const router = useRouter();
  const [initialState] = useState(getInitialGenerateState);
  const [presets, setPresets] = useState<Presets>(initialPresets);
  const [showInputs, setShowInputs] = useState(false);
  const [showStructure, setShowStructure] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedChars = initialState.selectedChars;
  const selectedCharacters = initialState.selectedCharacters;
  const comments = initialState.comments;
  const userNote = initialState.userNote;
  const musicAnalysis = initialState.musicAnalysis;
  const collectedCount = selectedCharacters.filter((id) => comments[id]).length;

  useEffect(() => {
    if (Object.keys(comments).length === 0) {
      router.push("/listen");
    }
  }, [comments, router]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);

    try {
      const commentList = selectedCharacters
        .filter((characterId) => comments[characterId])
        .map((characterId) => ({
          characterId,
          text: comments[characterId],
        }));
      const sessionId = await getExperimentSessionId();

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          selectedCharacters,
          comments: commentList,
          presets,
          userNote,
          musicAnalysis,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.imageUrl) {
        throw new Error(data.detail || data.error || "生成失败");
      }

      sessionStorage.setItem("imagePresets", JSON.stringify(presets));
      sessionStorage.setItem("generatedImageUrl", data.imageUrl);
      sessionStorage.setItem("generatedRemoteImageUrl", data.remoteImageUrl || "");
      sessionStorage.setItem("generatedImagePrompt", data.prompt || "");
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

      router.push("/result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败，请稍后重试");
      setGenerating(false);
    }
  };

  return (
    <main className="relative h-screen overflow-hidden bg-[#15111c] text-[#f8dfbb]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_34%,rgba(255,178,91,0.19),transparent_28%),radial-gradient(circle_at_50%_84%,rgba(255,183,92,0.13),transparent_34%),linear-gradient(135deg,#111420_0%,#2b2533_45%,#10121d_100%)]" />
      <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(115deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(25deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:180px_180px,220px_220px]" />

      <div className="relative z-10 flex h-screen flex-col px-4 py-3 lg:px-6 lg:py-4 2xl:px-14 2xl:py-6">
        <FlowHeader activeStep={4} />

        <section className="relative mt-3 flex min-h-0 flex-1 overflow-hidden rounded-[26px] border border-[#9f6f45]/55 bg-[#251f2b]/38 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] 2xl:mt-5">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-[-7%] right-[-7%] top-[20%] flex h-28 items-end justify-center gap-1 opacity-62">
              {Array.from({ length: 160 }).map((_, index) => (
                <span
                  key={index}
                  className="w-1 rounded-full bg-[#d99b4d]"
                  style={{
                    height: `${(8 + Math.abs(Math.sin(index * 0.13)) * 72).toFixed(1)}px`,
                    opacity: (0.2 + Math.abs(Math.sin(index * 0.19)) * 0.42).toFixed(3),
                  }}
                />
              ))}
            </div>
            <div className="absolute bottom-[-130px] left-1/2 h-[390px] w-[1260px] -translate-x-1/2 rounded-[50%] border border-[#d09a62]/28 bg-[#6f5949]/20 shadow-[0_30px_110px_rgba(0,0,0,0.5)]" />
          </div>

          {showInputs ? (
            <aside className="relative z-10 flex h-full min-h-0 w-[230px] shrink-0 flex-col gap-3 rounded-[22px] border border-[#a77b57]/48 bg-[#241f2a]/68 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.24)] backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-[#ffe3bd]">生成依据</h3>
                  <p className="mt-1 text-xs text-[#c7aa8d]">用于生成画面的输入信号</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInputs(false)}
                  className="rounded-full border border-[#a77b57]/42 px-2 py-1 text-xs text-[#d7b99b] hover:border-[#ffd083]/70"
                >
                  收起
                </button>
              </div>
              <div className="rounded-[16px] border border-[#8f6b52]/34 bg-[#2d2732]/78 p-3">
                <p className="mb-3 text-sm font-semibold text-[#ffe3bd]">音乐特征</p>
                <div className="space-y-2 text-xs text-[#d9bea0]">
                  <p className="flex justify-between gap-3"><span>速度</span><span>{musicAnalysis.bpm ? `${musicAnalysis.bpm} BPM` : normalizeText(musicAnalysis.tempo)}</span></p>
                  <p className="flex justify-between gap-3"><span>能量</span><span>{normalizeText(musicAnalysis.energy)}</span></p>
                  <p className="flex justify-between gap-3"><span>明亮度</span><span>{normalizeText(musicAnalysis.brightness)}</span></p>
                  <p className="flex justify-between gap-3"><span>情绪</span><span>{normalizeText(musicAnalysis.mood)}</span></p>
                </div>
              </div>
              <div className="rounded-[16px] border border-[#8f6b52]/34 bg-[#2d2732]/78 p-3">
                <p className="text-sm font-semibold text-[#ffe3bd]">导览点评</p>
                <p className="mt-2 text-xs text-[#d9bea0]">已收集 {collectedCount} / {Math.max(selectedCharacters.length, 1)} 条</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedChars.map((character) => (
                    <span key={character.id} className="rounded-full border border-[#d5a36b]/36 bg-[#3a2d32]/78 px-3 py-1 text-xs text-[#f1d0aa]">
                      {displayCharacter(character).name}
                    </span>
                  ))}
                </div>
              </div>
              <div className="min-h-0 flex-1 rounded-[16px] border border-[#8f6b52]/34 bg-[#2d2732]/78 p-3">
                <p className="text-sm font-semibold text-[#ffe3bd]">用户笔记</p>
                <p className="mt-2 line-clamp-6 text-xs leading-relaxed text-[#d9bea0]">
                  {userNote || "暂未补充个人听感。"}
                </p>
              </div>
            </aside>
          ) : (
            <aside className="relative z-10 flex h-full w-[76px] shrink-0 items-start justify-center rounded-[22px] border border-[#a77b57]/36 bg-[#241f2a]/46 p-3 backdrop-blur">
              <button
                type="button"
                onClick={() => setShowInputs(true)}
                className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-[16px] border border-[#a77b57]/36 bg-[#2d2732]/58 text-[#ffe3bd] transition hover:border-[#ffd083]/70 hover:bg-[#3a2d32]/70"
              >
                <span className="text-lg">↗</span>
                <span className="text-xs leading-tight [writing-mode:vertical-rl]">生成依据</span>
              </button>
            </aside>
          )}

          <div className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden px-5 pb-[72px]">
            <div className="flex h-[58px] shrink-0 items-center justify-center">
              <div className="flex max-w-full items-center justify-center gap-2 rounded-full border border-[#a77b57]/38 bg-[#241f2a]/56 px-4 py-2 backdrop-blur">
                <span className="text-xs text-[#c7aa8d]">当前导览</span>
                {selectedChars.slice(0, 4).map((character) => {
                  const label = displayCharacter(character);
                  return (
                    <span
                      key={character.id}
                      className="rounded-full border border-[#d5a36b]/38 bg-[#3a2d32]/80 px-3 py-1 text-xs text-[#ffe3bd]"
                    >
                      {label.name} · {label.focus}
                    </span>
                  );
                })}
              </div>
            </div>

            <p className="mb-2 text-center text-xs text-[#d9bea0]">
              选择你想要的画面感觉，它会影响最终画作的风格、情绪和光色。
            </p>
            <div className="min-w-0 rounded-[24px] border border-[#8f6b52]/50 bg-[#191720]/82 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className="grid min-w-0 gap-2">
                <PresetGroup
                  type="style"
                  value={presets.style}
                  disabled={generating}
                  onChange={(style) => setPresets((prev) => ({ ...prev, style }))}
                />
                <PresetGroup
                  type="mood"
                  value={presets.mood}
                  disabled={generating}
                  onChange={(mood) => setPresets((prev) => ({ ...prev, mood }))}
                />
                <PresetGroup
                  type="tone"
                  value={presets.tone}
                  disabled={generating}
                  onChange={(tone) => setPresets((prev) => ({ ...prev, tone }))}
                />
              </div>
            </div>

            {error && (
              <p className="mt-2 text-center text-sm text-[#ff9f9f]">{error}</p>
            )}
          </div>

          {showStructure ? (
            <PromptStructure presets={presets} onClose={() => setShowStructure(false)} />
          ) : (
            <aside className="relative z-10 flex h-full w-[76px] shrink-0 items-start justify-center rounded-[22px] border border-[#a77b57]/36 bg-[#241f2a]/46 p-3 backdrop-blur">
              <button
                type="button"
                onClick={() => setShowStructure(true)}
                className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-[16px] border border-[#a77b57]/36 bg-[#2d2732]/58 text-[#ffe3bd] transition hover:border-[#ffd083]/70 hover:bg-[#3a2d32]/70"
              >
                <span className="text-lg">↖</span>
                <span className="text-xs leading-tight [writing-mode:vertical-rl]">画面结构</span>
              </button>
            </aside>
          )}

          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="absolute bottom-3 left-1/2 z-30 flex h-[58px] w-[min(460px,40vw)] -translate-x-1/2 items-center justify-center rounded-[20px] border border-[#ffd083]/76 bg-[#4b3444]/92 text-lg font-semibold text-[#ffe3bd] shadow-[0_0_34px_rgba(255,194,103,0.34),0_18px_56px_rgba(0,0,0,0.34)] transition hover:-translate-y-0.5 hover:bg-[#5a3b4d] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {generating ? "生成中..." : "生成画作 →"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/listen")}
            className="absolute bottom-4 left-4 z-30 rounded-[14px] border border-[#a77b57]/48 bg-[#241f2a]/76 px-5 py-3 text-sm text-[#ffe3bd] backdrop-blur transition hover:border-[#d8a464]/70"
          >
            返回聆听室
          </button>
        </section>
      </div>
    </main>
  );
}
