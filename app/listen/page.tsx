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
  StudyTrial,
  VisualBrief,
  VisualBriefFieldStatus,
} from "@/lib/contracts";
import type { FacilitatorPlan } from "@/lib/agents/facilitator";
import { readConversationStream } from "@/lib/conversation";
import {
  assessVisualBriefSlots,
  type VisualBriefSlotKey,
} from "@/lib/visual-brief";
import { isGenerationActionBlocked } from "@/lib/conversation/generation-guard";
import { isMeaningfulUserInput } from "@/lib/conversation/user-input";
import { ensureStudyTrial, startDirectBaseline } from "@/lib/experiment-trial-client";
import CrystalAudioVisualizer from "@/components/CrystalAudioVisualizer";

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
    feelingPlaceholder: "写下此刻浮现的感受或画面",
    freeInputHint: "不用组织语言，也不用描述完整。写下任何浮现的画面、感受或念头。",
    inspiration: "需要一点灵感",
    hideInspiration: "收起灵感提示",
    inspirationHint: "不用逐项回答，只选一个你愿意继续感受的方向。",
    inspirationDimensions: ["它给你的整体尺度感", "画面是否在运动或变化", "最靠近你的光、颜色或触感", "你最不想丢掉的感觉"],
    collapse: "收起",
    sendFeeling: "发送听感",
    sendingFeeling: "正在发送",
    closeComment: "关闭评论",
    resonate: "更接近我的听感",
    resonated: "已作为重点听法",
    guideTip: "点击音乐家听点评，点亮共鸣或补充自己的听感。",
    roomTitle: "共同画面",
    roomSubtitle: "你先说出第一感觉，音乐家从不同角度回应，最后由你决定画面。",
    singleRoomSubtitle: "先留下你的第一感觉，再沿着不同回应慢慢形成画面。",
    facilitator: "共创引导",
    openChat: "展开聊天室",
    closeChat: "收起聊天室",
    nextSpeakerWaiting: "继续听下一位音乐家",
    nextGuideWaiting: "共创引导正在等你开启这一轮",
    waitingTurn: "先听完这一轮，主持人随后会邀请你补充",
    hostLabel: "主持引导",
    hostOpening: "先写下最先浮现的感觉，不需要完整。",
    hostListening: "先听音乐家的回应。全部听完后，再轮到你补充画面。",
    hostWriting: "轮到你了，请回答下面的问题。",
    hostReady: "画面已经聚拢，可以开始生成。",
    generateHint: "先留下你自己的感受，音乐家才会沿着它继续听。",
    inputNeedsDetail: "再写下一点属于你自己的感受或画面。",
    userNoteFailed: "这句话没有送达，请稍后重试。",
    pathA: "聆听路径 A",
    pathB: "聆听路径 B",
    reflectiveTip: "先写下你的第一感觉，音乐家会沿着它给出不同回应。",
    journalTitle: "你的画面起点",
    hearAtLeastOne: "至少听取一位音乐家的点评，才能让画面汇合。",
    generateEarly: "用当前线索提前生成",
    startMusic: "触碰水晶，让音乐回到房间",
    visualRecorded: "刚刚记下你的画面",
    analyzingEvidence: "正在理解你刚才描述的整体画面…",
    returnToGuides: "返回选择音乐家",
    returnToStart: "返回首页",
    changeGuidesConfirm: "更换音乐家会重置当前的共同聆听记录，确定返回吗？",
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
    stageOpening: "先从你的感受开始",
    stageExploring: "沿着你的画面继续",
    stageReady: "共同画面已经聚拢",
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
    feelingPlaceholder: "Write whatever feeling or image appears",
    freeInputHint: "No need to organize it or make it complete. Write any image, feeling, or thought that appears.",
    inspiration: "Need a little inspiration",
    hideInspiration: "Hide inspiration",
    inspirationHint: "You do not need to answer each one. Follow only the direction that feels useful.",
    inspirationDimensions: ["Its overall sense of scale", "Whether the image moves or changes", "The light, color, or texture closest to you", "The feeling you most want to preserve"],
    collapse: "Close",
    sendFeeling: "Send listening note",
    sendingFeeling: "Sending",
    closeComment: "Close comment",
    resonate: "Closer to my listening",
    resonated: "Marked as key lens",
    guideTip: "Tap a musician to hear their take, mark resonance, or add your own note.",
    roomTitle: "Shared Image",
    roomSubtitle: "Begin with your impression. The musicians respond from different angles, and you decide what remains.",
    singleRoomSubtitle: "Begin with your impression, then shape the image through different responses.",
    facilitator: "Co-creation guide",
    openChat: "Open conversation",
    closeChat: "Close conversation",
    nextSpeakerWaiting: "Hear the next musician",
    nextGuideWaiting: "The co-creation guide is ready for this round",
    waitingTurn: "Listen to this round first. The guide will invite you to add more.",
    hostLabel: "Listening guide",
    hostOpening: "Write the first feeling that appears. It does not need to be complete.",
    hostListening: "Listen to the musicians first. You will add to the image after everyone responds.",
    hostWriting: "Your turn. Please answer the question below.",
    hostReady: "The image has converged and is ready to generate.",
    generateHint: "Leave your own first impression, then the musicians will listen along it.",
    inputNeedsDetail: "Add a little of your own feeling or image.",
    userNoteFailed: "Your note did not send. Please try again.",
    pathA: "Listening Path A",
    pathB: "Listening Path B",
    reflectiveTip: "Begin with your own impression. The musicians will respond along that thread.",
    journalTitle: "Your image begins here",
    hearAtLeastOne: "Hear at least one musician before bringing the image together.",
    generateEarly: "Generate from Current Cues",
    startMusic: "Touch the crystal and bring the music back into the room",
    visualRecorded: "Your visual cue is now recorded",
    analyzingEvidence: "Understanding the overall image you just described...",
    returnToGuides: "Change musicians",
    returnToStart: "Back to start",
    changeGuidesConfirm: "Changing musicians will reset this shared listening session. Return anyway?",
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
    stageOpening: "Begin with your own impression",
    stageExploring: "Continue along your image",
    stageReady: "The shared image has converged",
    generate: "Generate Artwork →",
    generating: "Gathering what you heard together into an artwork",
    generationStages: ["Locking the shared image", "Composing the visual direction", "Generating and saving"],
    generationFailed: "Artwork generation failed. Please try again.",
  },
};

const EVIDENCE_SLOT_COPY: Record<Language, {
  title: string;
  count: (filled: number) => string;
  labels: Record<VisualBriefSlotKey, string>;
}> = {
  zh: {
    title: "画面线索",
    count: (filled) => `${filled} / 4`,
    labels: {
      scene: "场景",
      dynamics: "变化",
      sensory: "光色",
      meaning: "感受",
    },
  },
  en: {
    title: "Image cues",
    count: (filled) => `${filled} / 4`,
    labels: {
      scene: "Scene",
      dynamics: "Change",
      sensory: "Light",
      meaning: "Feeling",
    },
  },
};

function EvidenceSlotCheck({
  brief,
  language,
  compact = false,
}: {
  brief: VisualBrief;
  language: Language;
  compact?: boolean;
}) {
  const copy = EVIDENCE_SLOT_COPY[language];
  const slots = assessVisualBriefSlots(brief.fields);
  const filled = slots.filter((slot) => slot.status === "filled").length;
  const progress = `${Math.max(0, Math.min(100, filled * 25))}%`;

  if (compact) {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-2 text-[9px]">
        <span className="shrink-0 font-semibold text-[#c9a783]">{copy.title}</span>
        <span className="shrink-0 text-[#927b68]">{copy.count(filled)}</span>
        <div className="h-px min-w-10 flex-1 overflow-hidden bg-[#6f5848]/38">
          <div
            className="h-full bg-[#d9aa66] transition-[width] duration-700"
            style={{ width: progress }}
          />
        </div>
        {slots.map((slot) => {
          const complete = slot.status === "filled";
          return (
            <span
              key={slot.key}
              className={`flex shrink-0 items-center gap-1 ${complete ? "text-[#d9b98e]" : "text-[#74675c]"}`}
            >
              <span className={`h-1 w-1 rounded-full ${complete ? "bg-[#dfb66f]" : "bg-[#66584d]"}`} />
              {copy.labels[slot.key]}
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div className="border-l-2 border-[#dca45f]/58 bg-[#2b232d]/72 px-3 py-2">
      <div className="flex items-center justify-between gap-3 text-[10px] tracking-[0.08em]">
        <span className="font-semibold text-[#e8c69f]">{copy.title}</span>
        <span className="text-[#ad9278]">{copy.count(filled)}</span>
      </div>
      <div className="mt-2 h-1 overflow-hidden bg-[#6f5848]/38">
        <div
          className="h-full bg-[#e6b76f] transition-[width] duration-700"
          style={{ width: progress }}
        />
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {slots.map((slot) => {
          const complete = slot.status === "filled";
          return (
            <div key={slot.key} className="flex min-w-0 items-center gap-1.5">
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full transition ${
                  complete ? "bg-[#f0c57d] shadow-[0_0_8px_rgba(240,197,125,0.65)]" : "bg-[#705d51]"
                }`}
              />
              <span className={`truncate text-[10px] ${complete ? "text-[#efd2aa]" : "text-[#8e7a6b]"}`}>
                {copy.labels[slot.key]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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

  const src = sessionStorage.getItem("audioSrc") || sessionStorage.getItem("audioObjectUrl") || "";
  let ids: string[] = [];
  let comments: Record<string, string> = {};
  let conversationState: ConversationState | null = null;
  let visualBrief: VisualBrief | null = null;
  let resonantCharacterIds: string[] = [];
  let facilitatorPlan: FacilitatorPlan | null = null;
  try {
    const parsed = JSON.parse(sessionStorage.getItem("selectedCharacters") || "[]");
    ids = Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    ids = [];
  }
  try {
    const parsed = JSON.parse(sessionStorage.getItem("comments") || "{}");
    comments = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, string>
      : {};
  } catch {
    comments = {};
  }
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
      if (message.role === "musician" || message.role === "guide") {
        comments[message.speakerId] = message.content;
      }
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
    if (source.kind === "guide-message") names.add(copy.facilitator);
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
        <span>{brief?.readiness.ready ? copy.visualReady : candidates.length ? copy.visualRecorded : copy.visualForming}</span>
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
  canSpeak,
  compact,
  stageOffset,
  onClick,
  onSpeak,
  language,
}: {
  character: Character;
  active: boolean;
  commented: boolean;
  loading: boolean;
  streaming: boolean;
  canSpeak: boolean;
  compact: boolean;
  stageOffset: string;
  onClick: () => void;
  onSpeak: () => void;
  language: Language;
}) {
  const label = characterUi[language][character.id as keyof typeof characterUi.zh] || {
    name: character.name,
    focus: character.focusDescription,
  };

  return (
    <div
      className={`pointer-events-none group absolute z-40 flex w-[clamp(148px,12vw,192px)] origin-bottom flex-col items-center text-center transition duration-500 ${
        compact ? "scale-[0.82]" : ""
      } ${stageOffset}`}
    >
      {canSpeak && !loading && !streaming && (
        <>
          <div className="mv-guide-aura absolute left-1/2 top-[30px] h-[clamp(150px,18vh,210px)] w-[clamp(120px,10vw,170px)] rounded-[50%] border border-[#ffd083]/65 bg-[#ffc267]/16 blur-[2px] shadow-[0_0_42px_rgba(255,194,103,0.55)]" />
          <div className="mv-guide-aura absolute bottom-[30px] left-1/2 h-[clamp(52px,5vw,72px)] w-[clamp(162px,13vw,220px)] rounded-[50%] border border-[#ffd481]/70 bg-[#ffc267]/24 shadow-[0_0_36px_rgba(255,194,103,0.7)]" />
        </>
      )}
      {canSpeak && !loading && !streaming && (
        <button
          type="button"
          onClick={onSpeak}
          className="pointer-events-auto absolute left-1/2 top-[-24px] z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-[#ffd083]/80 bg-[#ffe0bd]/96 px-3.5 py-2 shadow-[0_0_28px_rgba(255,208,131,0.55)] transition hover:-translate-y-1 hover:bg-[#fff0d4]"
          aria-label={language === "zh" ? `听${label.name}说` : `Hear ${label.name}`}
        >
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#5b3e31]"
              style={{ animationDelay: `${dot * 140}ms`, animationDuration: "900ms" }}
            />
          ))}
        </button>
      )}
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
          canSpeak
            ? "scale-[1.06] brightness-110 drop-shadow-[0_0_30px_rgba(255,218,145,0.82)]"
            : active ? "scale-[1.06] drop-shadow-[0_0_24px_rgba(255,218,145,0.74)]" : "drop-shadow-[0_24px_24px_rgba(0,0,0,0.46)] group-hover:scale-[1.025]"
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

function ReflectiveGuideFigure({
  character,
  active,
  open,
  loading,
  streaming,
  comment,
  canOpen,
  stageOffset,
  onOpen,
  language,
}: {
  character: Character;
  active: boolean;
  open: boolean;
  loading: boolean;
  streaming: boolean;
  comment: string;
  canOpen: boolean;
  stageOffset: string;
  onOpen: () => void;
  language: Language;
}) {
  const label = characterUi[language][character.id as keyof typeof characterUi.zh] || {
    name: character.name,
  };
  return (
    <div className={`pointer-events-none group absolute z-40 flex w-[clamp(154px,12vw,194px)] flex-col items-center text-center ${stageOffset}`}>
      {!open && canOpen && (
        <button
          type="button"
          onClick={onOpen}
          className="pointer-events-auto absolute left-1/2 top-[-20px] z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-[#ffd083]/80 bg-[#ffe0bd]/94 px-3.5 py-2 shadow-[0_0_26px_rgba(255,208,131,0.46)] transition hover:-translate-y-1 hover:bg-[#fff1d6]"
          aria-label={language === "zh" ? `听${label.name}说` : `Hear ${label.name}`}
        >
          {[0, 1, 2].map((dot) => (
            <span key={dot} className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#5b3e31]" style={{ animationDelay: `${dot * 140}ms`, animationDuration: "900ms" }} />
          ))}
        </button>
      )}
      <div className={`absolute bottom-[40px] h-[clamp(42px,5vw,64px)] w-[clamp(150px,11.5vw,204px)] rounded-[50%] border transition duration-300 ${active ? "border-[#ffd481] bg-[#ffc267]/28 shadow-[0_0_38px_rgba(255,194,103,0.86),0_22px_38px_rgba(0,0,0,0.45)]" : "border-[#b9895d]/46 bg-black/28 shadow-[0_22px_48px_rgba(0,0,0,0.42)]"}`} />
      <button
        type="button"
        onClick={onOpen}
        disabled={!canOpen}
        className={`relative z-10 mb-1 flex h-[clamp(186px,22vh,254px)] items-end justify-center outline-none transition duration-300 ${
          canOpen
            ? "pointer-events-auto"
            : "pointer-events-none opacity-[0.82]"
        } ${active ? "scale-[1.055] drop-shadow-[0_0_24px_rgba(255,218,145,0.74)]" : "drop-shadow-[0_24px_24px_rgba(0,0,0,0.46)] group-hover:scale-[1.025]"}`}
      >
        <Image src={`/characters/stage/${character.id}.png`} alt={label.name} width={512} height={512} priority className={`h-auto max-h-[clamp(194px,23vh,266px)] object-contain ${FIGURE_STYLE[character.id] || "w-[clamp(164px,11vw,214px)]"}`} />
      </button>
      <div className={`relative z-20 flex items-center gap-2 rounded-full border px-3 py-1.5 text-[#ffe8c9] backdrop-blur ${active ? "border-[#ffc976]/80 bg-[#654531]/72" : "border-[#a47b5a]/38 bg-[#2f2832]/68"}`}>
        <span className={`h-2.5 w-2.5 rounded-full ${loading || streaming ? "bg-[#ffbd62]" : comment ? "bg-[#8dd28b]" : "bg-[#9b908d]"}`} />
        <p className="text-sm font-semibold">{label.name}</p>
      </div>
    </div>
  );
}

function ReflectiveCommentCard({
  character,
  loading,
  streaming,
  comment,
  resonant,
  onClose,
  onToggleResonance,
  language,
}: {
  character: Character;
  loading: boolean;
  streaming: boolean;
  comment: string;
  resonant: boolean;
  onClose: () => void;
  onToggleResonance: () => void;
  language: Language;
}) {
  const copy = COPY[language];
  const label = characterUi[language][character.id as keyof typeof characterUi.zh] || {
    name: character.name,
  };

  return (
    <article className="pointer-events-auto relative h-[112px] min-w-0 border border-[#f2bd7d]/74 bg-[#ffe0bd]/96 px-3 py-2.5 text-left text-[#322534] shadow-[0_16px_34px_rgba(0,0,0,0.3)]">
      <p className="truncate pr-14 text-xs font-semibold">{label.name}</p>
      {!loading && (
        <>
          <button
            type="button"
            onClick={onToggleResonance}
            className={`absolute right-9 top-2 flex h-6 w-6 items-center justify-center rounded-full border transition ${resonant ? "border-[#8b5e2f]/62 bg-[#5b3e31] text-[#ffe6c3]" : "border-[#9a7458]/40 bg-[#fff0d7] text-[#76513d] hover:bg-white"}`}
            aria-label={resonant ? copy.resonated : copy.resonate}
            title={resonant ? copy.resonated : copy.resonate}
          >
            ✦
          </button>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border border-[#9a7458]/40 bg-[#fff0d7] text-[#5b3e31] transition hover:bg-white"
            aria-label={copy.closeComment}
            title={copy.closeComment}
          >
            ×
          </button>
        </>
      )}
      <p className="mt-1.5 max-h-[4.35em] overflow-y-auto pr-1 text-xs font-medium leading-[1.45]">
        {loading ? copy.listening : comment}
        {streaming && <span className="ml-1 inline-block h-3.5 w-1 animate-pulse rounded-full bg-[#5b3e31]/70" />}
      </p>
    </article>
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
  const label = role === "guide"
    ? language === "zh" ? "共创引导" : "Co-creation guide"
    : character
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
      {!isUser && role === "guide" && (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#bd8b5d]/44 bg-[#332a35] text-[#ffd083]">
          ✦
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
  const [chatOpen, setChatOpen] = useState(() =>
    initialState.conversationState?.condition === "multi_agent" &&
    (
      (
        initialState.conversationState.turnOwner === "user" &&
        !initialState.conversationState.messages.some((message) => message.role === "user")
      ) ||
      initialState.conversationState.messages.some((message) => message.role === "musician")
    )
  );
  const [chatWasOpened, setChatWasOpened] = useState(() =>
    initialState.conversationState?.condition === "multi_agent" &&
    initialState.conversationState.messages.length > 0
  );
  const [showInspiration, setShowInspiration] = useState(false);
  const [allComments, setAllComments] = useState<Record<string, string>>(initialState.comments);
  const [visibleComments, setVisibleComments] = useState<Record<string, string>>(initialState.comments);
  const [revealed, setRevealed] = useState<Set<string>>(new Set(Object.keys(initialState.comments)));
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [streaming, setStreaming] = useState<Set<string>>(new Set());
  const [failedSpeakerId, setFailedSpeakerId] = useState("");
  const [resonantComments, setResonantComments] = useState<Set<string>>(
    new Set(initialState.resonantCharacterIds)
  );
  const [activeCharacterId, setActiveCharacterId] = useState<string>(
    selectedChars[0]?.id || ""
  );
  const [userNote, setUserNote] = useState("");
  const [pendingUserMessage, setPendingUserMessage] = useState<{ id: string; content: string } | null>(null);
  const [submittingUserNote, setSubmittingUserNote] = useState(false);
  const [userNoteError, setUserNoteError] = useState("");
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
  const autoplayAttemptedRef = useRef(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const turnInFlightRef = useRef(false);
  const turnAbortRef = useRef<AbortController | null>(null);
  const streamGenerationRef = useRef(0);
  const activeStreamSpeakerRef = useRef("");
  const allCommentsRef = useRef(initialState.comments);
  const conversationStateRef = useRef(initialState.conversationState);
  const userSubmissionInFlightRef = useRef(false);
  const visualBriefRefRef = useRef(initialState.conversationState?.visualBriefRef || null);
  const baselineRecoveryAttemptedRef = useRef(false);
  const trialRecoveryRef = useRef<Promise<StudyTrial | null> | null>(null);
  const reflectiveTimerRef = useRef<number | null>(null);
  const isReflective = conversationState?.condition === "single_agent";

  useEffect(() => {
    if (!conversationState) {
      router.push("/");
      return;
    }
    if (selectedChars.length === 0) {
      router.push("/select");
    }
  }, [conversationState, router, selectedChars.length]);

  useEffect(() => {
    if (baselineRecoveryAttemptedRef.current) return;
    baselineRecoveryAttemptedRef.current = true;
    try {
      const trial = JSON.parse(sessionStorage.getItem("studyTrial") || "null") as StudyTrial | null;
      const musicProfile = JSON.parse(sessionStorage.getItem("musicProfile") || "null") as MusicProfile | null;
      const musicAnalysis = JSON.parse(sessionStorage.getItem("musicAnalysis") || "null") as Record<string, unknown> | null;
      if (trial && musicProfile && musicAnalysis) {
        void startDirectBaseline({ trial, musicProfile, musicAnalysis }).catch((error) => {
          console.warn("Baseline recovery did not complete:", error);
        });
      }
    } catch {
      // The trial can still continue; the result page exposes a controlled retry.
    }
  }, []);

  useEffect(() => {
    const container = chatScrollRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [conversationState?.messages.length, pendingUserMessage, streaming, visibleComments]);

  useEffect(() => () => {
    streamGenerationRef.current += 1;
    turnAbortRef.current?.abort();
    if (reflectiveTimerRef.current !== null) window.clearTimeout(reflectiveTimerRef.current);
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

  const attemptAutoplay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || autoplayAttemptedRef.current) return;
    autoplayAttemptedRef.current = true;

    try {
      await audio.play();
      setAudioError("");
      setIsPlaying(true);
    } catch (error) {
      // Browsers may still require a gesture; the crystal remains the fallback control.
      if (error instanceof DOMException && error.name === "NotAllowedError") return;
      console.warn("Listening-room autoplay failed:", error);
      setAudioError(copy.playbackUnavailable);
    }
  }, [copy.playbackUnavailable]);

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
    conversationStateRef.current = mergedState;
    setConversationState(mergedState);
    sessionStorage.setItem("conversationState", JSON.stringify(mergedState));
  }, []);

  const ensureActiveTrial = useCallback(async (state: ConversationState) => {
    if (trialRecoveryRef.current) return trialRecoveryRef.current;
    const recovery = (async () => {
      const storedTrial = JSON.parse(sessionStorage.getItem("studyTrial") || "null") as StudyTrial | null;
      if (!storedTrial && state.trialId === state.sessionId) return null;
      if (!storedTrial || storedTrial.id !== state.trialId) {
        throw new Error("当前实验会话已失效，请返回首页重新开始");
      }
      const result = await ensureStudyTrial(storedTrial);
      sessionStorage.setItem("studyTrial", JSON.stringify(result.trial));
      sessionStorage.setItem("studyTrialId", result.trial.id);
      if (result.recovered) {
        recordExperimentEvent("trial-recovered", "/listen", {
          trialId: result.trial.id,
          condition: result.trial.condition,
        });
      }
      return result.trial;
    })();
    trialRecoveryRef.current = recovery;
    try {
      return await recovery;
    } finally {
      trialRecoveryRef.current = null;
    }
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
    recordExperimentEvent("guided-turn-started", "/listen", {
      trialId: state.trialId,
      condition: state.condition,
      conversationId: state.id,
      speakerId,
      role: state.condition === "single_agent" ? "guide" : "musician",
      round: state.completedUserRounds + 1,
    });

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
          turnInFlightRef.current = false;
          turnAbortRef.current = null;
          persistConversationState(event.state);
          recordExperimentEvent("guided-turn-completed", "/listen", {
            trialId: event.state.trialId,
            condition: event.state.condition,
            conversationId: event.state.id,
            speakerId,
            role: event.state.condition === "single_agent" ? "guide" : "musician",
            round: event.state.completedUserRounds + 1,
            characterCount: event.comment.length,
          });
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
      }
      turnInFlightRef.current = false;
      if (turnAbortRef.current === controller) turnAbortRef.current = null;
      if (activeStreamSpeakerRef.current === speakerId) activeStreamSpeakerRef.current = "";
    }
  }, [clearTurnIndicators, copy.failed, persistConversationState]);

  const handleReveal = (charId: string) => {
    setActiveCharacterId(charId);
    if (allComments[charId]) setRevealed((prev) => new Set(prev).add(charId));
  };

  const stopReflectiveStreaming = useCallback(() => {
    if (reflectiveTimerRef.current !== null) {
      window.clearTimeout(reflectiveTimerRef.current);
      reflectiveTimerRef.current = null;
    }
    setStreaming(new Set());
  }, []);

  const streamReflectiveComment = useCallback((charId: string, text: string) => {
    stopReflectiveStreaming();
    setVisibleComments((prev) => ({ ...prev, [charId]: "" }));
    setStreaming(new Set([charId]));
    let index = 0;
    const step = () => {
      index = Math.min(text.length, index + 1);
      setVisibleComments((prev) => ({ ...prev, [charId]: text.slice(0, index) }));
      if (index >= text.length) {
        reflectiveTimerRef.current = null;
        setStreaming(new Set());
        return;
      }
      const pause = /[，。！？,.!?]/.test(text[index - 1] || "") ? 110 : 42;
      reflectiveTimerRef.current = window.setTimeout(step, pause);
    };
    reflectiveTimerRef.current = window.setTimeout(step, 160);
  }, [stopReflectiveStreaming]);

  const handleReflectiveReveal = async (charId: string) => {
    if (
      !conversationState ||
      !isReflective ||
      loading.size > 0 ||
      !conversationState.messages.some((message) => message.role === "user")
    ) return;
    setActiveCharacterId(charId);
    setRevealed((current) => new Set(current).add(charId));
    if (allComments[charId]) {
      stopReflectiveStreaming();
      setVisibleComments((prev) => ({ ...prev, [charId]: allComments[charId] }));
      return;
    }

    setLoading(new Set([charId]));
    setVisibleComments((prev) => ({ ...prev, [charId]: "" }));
    try {
      const response = await fetch("/api/conversation/reflection/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationState,
          speakerId: charId,
          musicAnalysis: JSON.parse(sessionStorage.getItem("musicAnalysis") || "{}"),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Reflective comment failed");
      const comment = String(data.comment || "");
      persistConversationState(data.state as ConversationState);
      setAllComments((prev) => {
        const next = { ...prev, [charId]: comment };
        allCommentsRef.current = next;
        sessionStorage.setItem("comments", JSON.stringify(next));
        return next;
      });
      streamReflectiveComment(charId, comment);
      recordExperimentEvent("reflective-comment-opened", "/listen", {
        trialId: conversationState.trialId,
        condition: conversationState.condition,
        conversationId: conversationState.id,
        musicianId: charId,
        characterCount: comment.length,
      });
    } catch (error) {
      console.error(error);
      setVisibleComments((prev) => ({ ...prev, [charId]: copy.failed }));
    } finally {
      setLoading(new Set());
    }
  };

  const handleReflectiveClose = (charId: string) => {
    stopReflectiveStreaming();
    setVisibleComments((prev) => ({ ...prev, [charId]: allComments[charId] || prev[charId] || "" }));
    setRevealed((current) => {
      const next = new Set(current);
      next.delete(charId);
      return next;
    });
  };

  const handleSpeakerPrompt = (charId: string) => {
    if (
      !conversationState ||
      !["streaming-musician", "streaming-guide"].includes(conversationState.status) ||
      conversationState.queuedSpeakerIds[0] !== charId ||
      turnInFlightRef.current
    ) {
      return;
    }
    setChatOpen(true);
    setShowPlayerControls(false);
    setChatWasOpened(true);
    setActiveCharacterId(charId);
    if (failedSpeakerId === charId) setFailedSpeakerId("");
    void runScheduledTurn(conversationState);
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
    if (
      !content ||
      !conversationState ||
      submittingUserNote ||
      userSubmissionInFlightRef.current ||
      (isReflective && loading.size > 0) ||
      (!isReflective && conversationState.turnOwner !== "user")
    ) return;
    if (!isMeaningfulUserInput(content)) {
      setUserNoteError(copy.inputNeedsDetail);
      return;
    }

    userSubmissionInFlightRef.current = true;
    setSubmittingUserNote(true);
    setUserNoteError("");
    setPendingUserMessage({ id: crypto.randomUUID(), content });
    setUserNote("");
    cancelActiveTurn();
    try {
      const response = await fetch("/api/conversation/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationState,
          content,
          visualBrief,
          musicAnalysis: JSON.parse(sessionStorage.getItem("musicAnalysis") || "{}"),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Conversation response failed");
      const nextState = data.state as ConversationState;
      persistConversationState(nextState);
      if (
        nextState.condition === "multi_agent" &&
        nextState.status === "streaming-musician"
      ) {
        setChatOpen(false);
      }
      setShowInspiration(false);
      recordExperimentEvent("user-message-submitted", "/listen", {
        trialId: conversationState.trialId,
        condition: conversationState.condition,
        conversationId: conversationState.id,
        completedRound: (data.state as ConversationState).completedUserRounds,
        characterCount: content.length,
      });
      if (data.facilitatorPlan) {
        setFacilitatorPlan(data.facilitatorPlan as FacilitatorPlan);
        sessionStorage.setItem("facilitatorPlan", JSON.stringify(data.facilitatorPlan));
      }
      if (data.visualBrief) {
        const nextBrief = data.visualBrief as VisualBrief;
        setVisualBrief(nextBrief);
        sessionStorage.setItem("visualBrief", JSON.stringify(nextBrief));
        recordExperimentEvent("visual-brief-updated", "/listen", {
          trialId: conversationState.trialId,
          condition: conversationState.condition,
          conversationId: conversationState.id,
          version: nextBrief.version,
          completedRound: (data.state as ConversationState).completedUserRounds,
          readiness: nextBrief.readiness.ready,
        });
      }
      setPendingUserMessage(null);
      setFailedSpeakerId("");
    } catch (error) {
      console.error(error);
      setPendingUserMessage(null);
      setUserNote(content);
      setUserNoteError(error instanceof Error ? error.message : copy.userNoteFailed);
    } finally {
      userSubmissionInFlightRef.current = false;
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
        trialId: conversationState?.trialId,
        condition: conversationState?.condition,
        musicianId: charId,
        selected,
      });
      return next;
    });
  };

  const resolveGenerationBrief = async (state: ConversationState) => {
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
    if (
      !conversationState ||
      generationActionBlocked ||
      userSubmissionInFlightRef.current ||
      turnInFlightRef.current
    ) return;
    const generationState = conversationStateRef.current || conversationState;
    cancelActiveTurn();
    setGenerating(true);
    setGenerationProgress(6);
    setGenerationError("");
    recordExperimentEvent("generation-started", "/listen", {
      trialId: generationState.trialId,
      condition: generationState.condition,
      conversationId: generationState.id,
      musicianCount: generationState.selectedMusicianIds.length,
      resonantMusicianIds: [...resonantComments],
    });

    try {
      const activeTrial = await ensureActiveTrial(generationState);
      const musicProfileForBaseline = JSON.parse(sessionStorage.getItem("musicProfile") || "null") as MusicProfile | null;
      const musicAnalysisForBaseline = JSON.parse(sessionStorage.getItem("musicAnalysis") || "null") as Record<string, unknown> | null;
      if (activeTrial && musicProfileForBaseline && musicAnalysisForBaseline) {
        void startDirectBaseline({
          trial: activeTrial,
          musicProfile: musicProfileForBaseline,
          musicAnalysis: musicAnalysisForBaseline,
        }).catch((error) => console.warn("Recovered baseline did not complete:", error));
      }
      const stateResponse = await fetch("/api/conversation/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationState: generationState }),
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
          trialId: activeTrial?.id,
          generationRole: "co_created",
          condition: generationContext.state.condition,
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
      sessionStorage.setItem("coCreatedRunId", data.runId || "");
      sessionStorage.setItem("experimentSessionId", data.sessionId || sessionId);
      sessionStorage.setItem(
        "imageGenerationMeta",
        JSON.stringify({
          runId: data.runId,
          trialId: data.trialId || activeTrial?.id || "",
          generationRole: data.generationRole || "co_created",
          sessionId: data.sessionId || sessionId,
          provider: data.provider,
          model: data.model,
          imageSize: data.imageSize,
          requestId: data.requestId,
          promptSource: data.promptSource,
          promptDirector: data.promptDirector,
          logPath: data.logPath,
          timings: data.timings,
          usage: data.usage,
        })
      );
      setGenerationProgress(100);
      recordExperimentEvent("generation-completed", "/listen", {
        trialId: generationContext.state.trialId,
        condition: generationContext.state.condition,
        generationRole: "co_created",
        runId: data.runId,
        timings: data.timings,
      });
      router.push("/result");
    } catch (error) {
      console.error(error);
      recordExperimentEvent("generation-failed", "/listen", {
        trialId: conversationState.trialId,
        condition: conversationState.condition,
        generationRole: "co_created",
        error: error instanceof Error ? error.message : String(error),
      });
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
  const reflectiveStageSlotsByCount: Record<number, string[]> = {
    1: ["left-[24%] bottom-[168px] -translate-x-1/2"],
    2: [
      "left-[24%] bottom-[168px] -translate-x-1/2",
      "right-[24%] bottom-[168px] translate-x-1/2",
    ],
    3: [
      "left-[15%] bottom-[158px] -translate-x-1/2",
      "left-[32%] bottom-[200px] -translate-x-1/2",
      "right-[15%] bottom-[158px] translate-x-1/2",
    ],
    4: [
      "left-[13%] bottom-[154px] -translate-x-1/2",
      "left-[31%] bottom-[200px] -translate-x-1/2",
      "right-[31%] bottom-[200px] translate-x-1/2",
      "right-[13%] bottom-[154px] translate-x-1/2",
    ],
  };
  const compactStageSlotsByCount: Record<number, string[]> = {
    1: ["left-[22%] bottom-[12px] -translate-x-1/2"],
    2: [
      "left-[18%] bottom-[12px] -translate-x-1/2",
      "right-[18%] bottom-[12px] translate-x-1/2",
    ],
    3: [
      "left-[9%] bottom-[8px] -translate-x-1/2",
      "left-[29%] bottom-[8px] -translate-x-1/2",
      "right-[9%] bottom-[8px] translate-x-1/2",
    ],
    4: [
      "left-[7%] bottom-[6px] -translate-x-1/2",
      "left-[29%] bottom-[6px] -translate-x-1/2",
      "right-[29%] bottom-[6px] translate-x-1/2",
      "right-[7%] bottom-[6px] translate-x-1/2",
    ],
  };
  const conversationMessages = conversationState?.messages || [];
  const latestMessage = conversationMessages.at(-1);
  const hasUserContribution = conversationMessages.some((message) => message.role === "user");
  const compactConversationStage = !isReflective && chatOpen && hasUserContribution;
  const activeStageSlots = isReflective
    ? reflectiveStageSlotsByCount
    : compactConversationStage
      ? compactStageSlotsByCount
      : stageSlotsByCount;
  const stageSlots = activeStageSlots[Math.min(selectedChars.length, 4)] || activeStageSlots[4];
  const conversationReady = Boolean(
    conversationState?.status === "ready-to-generate" ||
    conversationState?.phase === "ready"
  );
  const generationReady = conversationReady;
  const reflectiveCanGenerate = generationReady;
  const visualEvidenceReady = Boolean(visualBrief?.readiness.ready);
  const needsMoreUserEvidence = !generationReady && !visualEvidenceReady;
  const generationActionBlocked = isGenerationActionBlocked({
    generating,
    submittingUserNote,
    hasPendingUserMessage: Boolean(pendingUserMessage),
    loadingCount: loading.size,
    streamingCount: streaming.size,
  });
  const waitingForNextAgent = Boolean(
    ["streaming-musician", "streaming-guide"].includes(conversationState?.status || "") &&
    conversationState?.queuedSpeakerIds.length
  );
  const nextScheduledSpeakerId = conversationState?.queuedSpeakerIds[0] || "";
  const nextScheduledCharacter = selectedChars.find(
    (character) => character.id === nextScheduledSpeakerId
  );
  const nextScheduledSpeakerName = nextScheduledCharacter
    ? characterUi[language][nextScheduledCharacter.id as keyof typeof characterUi.zh]?.name ||
      nextScheduledCharacter.name
    : "";
  const musicianTurnActive = waitingForNextAgent || loading.size > 0 || streaming.size > 0;
  const userTurnActive = Boolean(
    conversationState?.turnOwner === "user" &&
    !musicianTurnActive &&
    !submittingUserNote
  );
  const hostControlText = generationReady
    ? copy.hostReady
    : musicianTurnActive
      ? copy.hostListening
      : hasUserContribution
        ? copy.hostWriting
        : copy.hostOpening;
  const interactionStageLabel = generationReady
    ? copy.stageReady
    : hasUserContribution
      ? copy.stageExploring
      : copy.stageOpening;
  const timelineMessages = isReflective
    ? latestMessage?.role === "facilitator" &&
      latestMessage.content === facilitatorPlan?.userInvitation
      ? conversationMessages.slice(0, -1)
      : conversationMessages
    : conversationMessages.filter(
        (message) => message.role !== "guide" && message.role !== "facilitator"
      );
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

        <section className="relative mt-3 flex min-h-0 flex-1 overflow-hidden rounded-[22px] border border-[#9f6f45]/55 bg-[#251f2b]/42 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] 2xl:mt-5">
          <button
            type="button"
            onClick={() => {
              if (conversationMessages.length > 0 && !window.confirm(copy.changeGuidesConfirm)) return;
              router.push("/select");
            }}
            className="absolute left-3 top-3 z-[100] flex h-9 w-9 items-center justify-center rounded-full border border-[#9f6f45]/45 bg-[#211c26]/82 text-lg text-[#f5d3a8] transition hover:border-[#ffd083]/80 hover:bg-[#382b32]"
            aria-label={copy.returnToGuides}
            title={copy.returnToGuides}
          >
            ←
          </button>
          <div className="pointer-events-none absolute left-14 top-3 z-[99] border border-[#9f6f45]/45 bg-[#211c26]/82 px-3 py-2 text-[11px] font-semibold text-[#f5d3a8]">
            {isReflective ? copy.pathA : copy.pathB}
          </div>
          <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
            {audioSrc && (
              <audio
                ref={audioRef}
                crossOrigin="anonymous"
                src={audioSrc}
                preload="auto"
                autoPlay
                loop
                onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
                onCanPlay={() => void attemptAutoplay()}
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

            {!showPlayerControls &&
              !(isReflective && revealed.size > 0) &&
              !(!isReflective && chatOpen) &&
              !(isReflective && hasUserContribution && visualBrief) && (
              <VisualBriefTrace
                brief={visualBrief}
                state={conversationState}
                selectedChars={selectedChars}
                language={language}
              />
            )}

            {!showPlayerControls &&
              isReflective &&
              hasUserContribution &&
              visualBrief &&
              revealed.size === 0 && (
                <div className="absolute left-1/2 top-2 z-[72] w-[min(720px,72vw)] -translate-x-1/2">
                  <EvidenceSlotCheck
                    brief={visualBrief}
                    language={language}
                  />
                </div>
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
              {isReflective && revealed.size > 0 && (
                <div
                  className={`pointer-events-none absolute inset-x-4 top-0 z-[86] grid gap-2.5 ${
                    selectedChars.length === 1
                      ? "grid-cols-1"
                      : selectedChars.length === 2
                        ? "grid-cols-2"
                        : selectedChars.length === 3
                          ? "grid-cols-3"
                          : "grid-cols-4"
                  }`}
                >
                  {selectedChars.map((character) => revealed.has(character.id) ? (
                    <ReflectiveCommentCard
                      key={character.id}
                      character={character}
                      loading={loading.has(character.id)}
                      streaming={streaming.has(character.id)}
                      comment={visibleComments[character.id] || ""}
                      resonant={resonantComments.has(character.id)}
                      onClose={() => handleReflectiveClose(character.id)}
                      onToggleResonance={() => toggleResonance(character.id)}
                      language={language}
                    />
                  ) : (
                    <div key={character.id} aria-hidden="true" />
                  ))}
                </div>
              )}

              {selectedChars.map((character, index) => isReflective ? (
                <ReflectiveGuideFigure
                  key={character.id}
                  character={character}
                  active={character.id === activeCharacterId}
                  open={revealed.has(character.id)}
                  loading={loading.has(character.id)}
                  streaming={streaming.has(character.id)}
                  comment={visibleComments[character.id] || ""}
                  canOpen={hasUserContribution}
                  stageOffset={stageSlots[index] || stageSlots[stageSlots.length - 1]}
                  onOpen={() => void handleReflectiveReveal(character.id)}
                  language={language}
                />
              ) : (
                <GuideFigure
                  key={character.id}
                  character={character}
                  active={character.id === activeCharacterId}
                  commented={revealed.has(character.id)}
                  loading={loading.has(character.id)}
                  streaming={streaming.has(character.id)}
                  canSpeak={
                    conversationState?.status === "streaming-musician" &&
                    conversationState.queuedSpeakerIds[0] === character.id &&
                    !loading.has(character.id) &&
                    !streaming.has(character.id)
                  }
                  compact={compactConversationStage}
                  stageOffset={stageSlots[index] || stageSlots[stageSlots.length - 1]}
                  onClick={() => handleReveal(character.id)}
                  onSpeak={() => handleSpeakerPrompt(character.id)}
                  language={language}
                />
              ))}

              <div className={`absolute left-1/2 z-30 h-[clamp(238px,19vw,300px)] w-[clamp(238px,19vw,300px)] origin-bottom -translate-x-1/2 transition duration-500 ${
                isReflective
                  ? "bottom-[176px]"
                  : compactConversationStage
                    ? "bottom-[8px] scale-[0.82]"
                    : "bottom-[78px]"
              }`}>
                <div className="absolute left-1/2 top-[-34px] h-[300px] w-[clamp(300px,24vw,380px)] -translate-x-1/2">
                  <CrystalAudioVisualizer audioRef={audioRef} active={isPlaying} mode="pulse">
                    <button
                      type="button"
                      onClick={togglePlay}
                      className="group/crystal relative flex h-[190px] w-[210px] cursor-pointer items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#ffd083]"
                      aria-label={isPlaying ? copy.pause : copy.play}
                    >
                      <div className={`absolute inset-3 rounded-full bg-[#ffc267]/18 blur-2xl transition duration-500 ${isPlaying ? "scale-125 opacity-100" : "scale-95 opacity-45 group-hover/crystal:scale-110 group-hover/crystal:opacity-85"}`} />
                      <div className={`absolute inset-0 rounded-full border border-[#ffd98b]/32 transition duration-500 ${isPlaying ? "scale-110 opacity-80 shadow-[0_0_54px_rgba(255,196,99,0.48)]" : "scale-95 opacity-35 group-hover/crystal:scale-105 group-hover/crystal:opacity-70"}`} />
                      <div className="pointer-events-none absolute bottom-[15%] h-[72px] w-[200px] rounded-[50%] border border-[#f3bb75]/42 bg-[#72533f]/42 shadow-[0_18px_66px_rgba(0,0,0,0.46),0_0_34px_rgba(255,195,97,0.16)]" />
                      <Image
                        src="/stage-gem-transparent.webp"
                        alt=""
                        width={1254}
                        height={1254}
                        priority
                        unoptimized
                        className="pointer-events-none relative z-10 h-auto w-[clamp(168px,13vw,220px)] opacity-95 transition duration-500 group-hover/crystal:brightness-110"
                      />
                    </button>
                  </CrystalAudioVisualizer>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = !showPlayerControls;
                    setShowPlayerControls(next);
                    if (next && !isReflective) setChatOpen(false);
                  }}
                  className="absolute bottom-[-14px] left-1/2 z-40 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-[#c9965d]/46 bg-[#1f1a24]/90 text-[#ffe3bd]"
                  aria-label={showPlayerControls ? copy.collapseProgress : copy.expandProgress}
                >
                  {showPlayerControls ? "⌄" : "⌃"}
                </button>
              </div>
              {!isPlaying && !hasUserContribution && (
                <p className={`pointer-events-none absolute left-1/2 z-20 w-[min(280px,64%)] -translate-x-1/2 text-center text-xs font-medium tracking-[0.06em] text-[#f0cf9f]/86 ${isReflective ? "bottom-[156px]" : "bottom-[42px]"}`}>
                  {copy.startMusic}
                </p>
              )}
            </div>

            {isReflective && (
              <div
                className={`left-1/2 z-[92] w-[min(720px,78vw)] border border-[#b9895d]/52 bg-[#211c26]/94 px-5 py-3 shadow-[0_18px_58px_rgba(0,0,0,0.38)] backdrop-blur ${
                  hasUserContribution
                    ? "fixed bottom-2"
                    : "absolute top-4"
                }`}
                style={{
                  transform: "translateX(-50%)",
                }}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <p className="font-serif text-base font-semibold text-[#ffe3bd]">{hasUserContribution ? interactionStageLabel : copy.journalTitle}</p>
                    <span className="h-px min-w-8 flex-1 bg-[#9f7655]/32" />
                  </div>
                  {showInspiration ? (
                    <div className="mt-1 text-[11px] leading-relaxed text-[#d5b99c]">
                      <span className="text-[#a98d74]">{copy.inspirationHint}</span>
                      <span className="ml-2">
                        {copy.inspirationDimensions.map((dimension) => `· ${dimension}`).join("  ")}
                      </span>
                    </div>
                  ) : (
                    <p className="mt-1 text-xs font-medium leading-relaxed text-[#e5c39e]">
                      {hasUserContribution
                        ? generationReady
                          ? facilitatorPlan?.stageSubtitle
                          : facilitatorPlan?.userInvitation || copy.reflectiveTip
                        : copy.freeInputHint}
                    </p>
                  )}
                </div>
                {submittingUserNote && (
                  <p className="mt-2 animate-pulse text-xs text-[#e2bb8d]">
                    {copy.analyzingEvidence}
                  </p>
                )}
                {!generationReady ? (
                  <>
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => setShowInspiration((current) => !current)}
                        className="text-[11px] text-[#bfa184] transition hover:text-[#ffe3bd]"
                        aria-expanded={showInspiration}
                      >
                        {showInspiration ? copy.hideInspiration : copy.inspiration}
                      </button>
                    </div>
                    <div className="mt-2 flex items-center gap-2 border border-[#8c6a50]/48 bg-[#17141b]/76 px-3 py-2">
                      <textarea
                        value={userNote}
                        onChange={(event) => {
                          setUserNote(event.target.value);
                          setUserNoteError("");
                        }}
                        disabled={loading.size > 0 || submittingUserNote}
                        placeholder={copy.feelingPlaceholder}
                        rows={1}
                        className="h-7 min-w-0 flex-1 resize-none bg-transparent text-sm leading-7 text-[#ffe3bd] outline-none placeholder:text-[#927c69] disabled:opacity-45"
                      />
                      <button type="button" onClick={handleSubmitUserNote} disabled={!userNote.trim() || submittingUserNote || loading.size > 0} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f4d09a] text-base font-semibold text-[#342831] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-35" aria-label={submittingUserNote ? copy.sendingFeeling : copy.sendFeeling}>
                        ↑
                      </button>
                    </div>
                  </>
                ) : (
                  <button type="button" onClick={handleContinue} disabled={!reflectiveCanGenerate || generationActionBlocked} className="mt-3 flex h-11 w-full items-center justify-center border border-[#f4bd72]/58 bg-[#4b3540]/88 text-sm font-semibold text-[#ffe3bd] transition hover:bg-[#5a3b49] disabled:cursor-not-allowed disabled:opacity-40">
                    {copy.generate}
                  </button>
                )}
                {userNoteError && <p className="mt-1.5 text-xs text-[#efb6a5]">{userNoteError}</p>}
                {generationError && <p className="mt-1.5 text-xs text-[#efb6a5]">{generationError}</p>}
              </div>
            )}

            {audioError && (
              <p className={`absolute left-1/2 z-[95] w-[min(520px,82%)] -translate-x-1/2 text-center text-xs text-[#efb6a5] ${isReflective ? "bottom-[154px]" : "bottom-5"}`}>
                {audioError}
              </p>
            )}
          </div>

          {!isReflective && (
            <>
          <aside
            className={`absolute left-1/2 z-[90] min-h-0 overflow-hidden border border-[#9f6f45]/48 bg-[#1d1923]/94 shadow-[0_24px_70px_rgba(0,0,0,0.42)] backdrop-blur transition-[opacity,transform] duration-500 ${
              hasUserContribution
                ? "top-4 h-[min(300px,42vh)] w-[min(780px,76vw)]"
                : "top-4 h-auto w-[min(640px,78vw)]"
            } ${
              chatOpen
                ? "opacity-100"
                : "pointer-events-none opacity-0"
            }`}
            style={{
              transform: "translateX(-50%)",
            }}
          >
            <div className={`flex min-w-0 flex-col ${hasUserContribution ? "h-full" : ""}`}>
            <header className="relative shrink-0 border-b border-[#9f6f45]/30 px-5 py-3">
              <div className="flex items-baseline gap-3 pr-10">
                <p className="font-serif text-lg font-semibold text-[#ffe3bd]">
                  {hasUserContribution ? copy.roomTitle : copy.journalTitle}
                </p>
                <p className="text-[11px] font-medium tracking-[0.08em] text-[#d8b080]">
                  {interactionStageLabel}
                </p>
                {hasUserContribution && visualBrief && (
                  <EvidenceSlotCheck
                    brief={visualBrief}
                    language={language}
                    compact
                  />
                )}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-[#c9aa8c]">
                {hasUserContribution ? copy.roomSubtitle : copy.freeInputHint}
              </p>
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-[#8f6b52]/42 text-[#c9aa8c] transition hover:border-[#ffd083]/70 hover:text-[#ffe3bd]"
                aria-label={copy.closeChat}
                title={copy.closeChat}
              >
                ×
              </button>
            </header>

            <div className={hasUserContribution ? "flex min-h-0 flex-1" : ""}>
            <div
              ref={chatScrollRef}
              className={`min-h-0 overflow-y-auto px-4 ${hasUserContribution ? "flex-1 py-3" : "py-0"}`}
            >
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
              {pendingUserMessage && (
                <div className="opacity-90">
                  <ConversationEntry
                    key={pendingUserMessage.id}
                    role="user"
                    speakerId="user"
                    content={pendingUserMessage.content}
                    selectedChars={selectedChars}
                    language={language}
                  />
                  <p className="mb-3 text-right text-[10px] text-[#c6a17d]">{copy.analyzingEvidence}</p>
                </div>
              )}
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

            <div className={`flex min-h-0 shrink-0 flex-col overflow-hidden bg-[#211c26]/96 px-4 py-3 ${
              hasUserContribution
                ? "w-[min(330px,42%)] border-l border-[#9f6f45]/32"
                : "border-t border-[#9f6f45]/32"
            }`}>
              <div className="shrink-0 border-l-2 border-[#dca45f]/58 pl-3">
                <p className="text-[10px] font-semibold tracking-[0.12em] text-[#d9ac79]">
                  {copy.hostLabel}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[#e6c6a4]">
                  {hostControlText}
                </p>
              </div>
              {["streaming-musician", "streaming-guide"].includes(conversationState?.status || "") &&
                (conversationState?.queuedSpeakerIds.length || 0) > 0 &&
                streaming.size === 0 &&
                loading.size === 0 && (
                  <button
                    type="button"
                    onClick={() => handleSpeakerPrompt(nextScheduledSpeakerId)}
                    className="mt-2 flex h-9 w-full shrink-0 items-center justify-between border border-[#c8955e]/48 bg-[#3a2d35]/72 px-3 text-left text-xs font-semibold text-[#ffd39a] transition hover:border-[#ffd083] hover:bg-[#493440] hover:text-[#ffe7c3]"
                  >
                    <span>
                      {copy.nextSpeakerWaiting}
                      {nextScheduledSpeakerName ? ` · ${nextScheduledSpeakerName}` : ""}
                    </span>
                    <span>→</span>
                  </button>
                )}
              {userTurnActive && needsMoreUserEvidence && facilitatorPlan?.userInvitation && (
                <p
                  key={facilitatorPlan.userInvitation}
                  className="mt-2 shrink-0 border-l border-[#9f7655]/42 pl-2 text-[11px] leading-relaxed text-[#bda186]"
                >
                  {facilitatorPlan.userInvitation}
                </p>
              )}
              {needsMoreUserEvidence && (
                <div className={hasUserContribution ? "mt-auto pt-2" : "mt-2"}>
                  <div className={`flex items-center gap-2 rounded-[10px] border px-3 py-1.5 transition duration-300 ${
                    userTurnActive
                      ? "mv-user-turn border-[#f1bd76]/85 bg-[#46323b]/72"
                      : "border-[#6f5a4b]/34 bg-[#18151c]/58 opacity-70"
                  }`}>
                    <textarea
                      value={userNote}
                      onChange={(event) => {
                        setUserNote(event.target.value);
                        setUserNoteError("");
                      }}
                      disabled={!userTurnActive}
                      placeholder={userTurnActive ? copy.feelingPlaceholder : copy.waitingTurn}
                      rows={1}
                      className="h-8 min-w-0 flex-1 resize-none bg-transparent text-sm leading-8 text-[#ffe3bd] outline-none placeholder:text-[#927c69] disabled:cursor-not-allowed"
                    />
                    <button
                      type="button"
                      onClick={handleSubmitUserNote}
                      disabled={!userTurnActive || !userNote.trim() || submittingUserNote}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f4d09a] text-base font-semibold text-[#342831] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label={submittingUserNote ? copy.sendingFeeling : copy.sendFeeling}
                    >
                      ↑
                    </button>
                  </div>
                </div>
              )}
              {userNoteError && <p className="mt-2 text-xs text-[#efb6a5]">{userNoteError}</p>}
              {generationError && <p className="mt-2 text-xs text-[#efb6a5]">{generationError}</p>}
              {hasUserContribution && generationReady && (
                <button
                  type="button"
                  onClick={handleContinue}
                  disabled={generationActionBlocked}
                  className="mt-auto flex h-10 w-full shrink-0 items-center justify-center border border-[#f4bd72]/58 bg-[#4b3540]/88 px-5 text-sm font-semibold text-[#ffe3bd] shadow-[0_12px_34px_rgba(0,0,0,0.26)] transition hover:bg-[#5a3b49] disabled:cursor-not-allowed disabled:border-[#735844]/35 disabled:bg-[#2a242d] disabled:text-[#806f61]"
                >
                  {copy.generate}
                </button>
              )}
            </div>
            </div>
            </div>
          </aside>

          {!chatOpen && chatWasOpened && (
            <button
              type="button"
              onClick={() => {
                setShowPlayerControls(false);
                setChatOpen(true);
              }}
              className="absolute left-1/2 top-3 z-[95] flex h-9 w-9 items-center justify-center rounded-full border border-[#b1845d]/48 bg-[#2b242e]/94 text-[#ffe3bd] shadow-[0_10px_30px_rgba(0,0,0,0.28)] transition hover:border-[#ffd083]/70 hover:bg-[#3a2d36]"
              style={{ transform: "translateX(-50%)" }}
              aria-label={copy.openChat}
              title={copy.openChat}
            >
              …
            </button>
          )}
            </>
          )}

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
