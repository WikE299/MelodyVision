"use client";

import { useState, useEffect, useRef, useCallback, type SyntheticEvent } from "react";
import { useRouter } from "next/navigation";
import FlowHeader from "@/components/FlowHeader";
import { getCharactersByIds, type Character } from "@/lib/characters";
import { getExperimentSessionId } from "@/lib/experiment-session";
import { recordExperimentEvent } from "@/lib/experiment-events";
import { startDirectBaseline } from "@/lib/experiment-trial-client";
import { characterUi, type Language, useHydrated, useLanguage } from "@/lib/i18n";
import type {
  ConversationState,
  GenerationRole,
  MusicProfile,
  StudyTrial,
  VisualBrief,
  VisualBriefFieldKey,
} from "@/lib/contracts";

interface PromptDirectorResultView {
  userSourceMappings?: Array<{
    sourceId: string;
    visualTranslation: string;
  }>;
  visualBriefMappings?: Array<{
    field: VisualBriefFieldKey;
    status: string;
    visualTranslation: string;
  }>;
  sourceMappings?: Array<{
    characterId: string;
    speaker: string;
    visualTranslation: string;
  }>;
}

interface PromptDirectorTrace {
  source?: string;
  result?: PromptDirectorResultView | null;
  repaired?: boolean;
}

interface GenerationMeta {
  runId?: string;
  sessionId?: string;
  provider?: string;
  model?: string;
  imageSize?: string;
  requestId?: string;
  promptSource?: string;
  promptDirector?: PromptDirectorTrace | null;
  logPath?: string;
  timings?: Record<string, number>;
  usage?: unknown;
}

interface DebugInfo {
  musicAnalysis: unknown;
  prompt: string;
  meta: GenerationMeta | null;
  remoteImageUrl: string;
}

interface BaselineResult {
  runId: string;
  imageUrl: string;
  prompt: string;
  imageModel: string;
  imageSize: string;
}

interface FeedbackState {
  musicMatchScore: number;
  commentMatchScore: number;
  aestheticScore: number;
  selectedReasons: string[];
  freeText: string;
}

type StudyPhase = "artwork" | "comparison" | "manipulation" | "completed";
type RatingKey =
  | "musicMatchScore"
  | "imaginationMatchScore"
  | "agencyScore"
  | "ownershipScore"
  | "immersionScore"
  | "satisfactionScore";
type ComparisonChoice = GenerationRole | "tie";
type ManipulationKey =
  | "perspectiveMultiplicityScore"
  | "articulationSupportScore"
  | "dialogueExperienceScore";

const FEEDBACK_REASONS = {
  zh: ["很准确", "情绪对", "风格不对", "太抽象", "不像音乐", "画面好看"],
  en: ["Accurate", "Right mood", "Wrong style", "Too abstract", "Not musical", "Beautiful image"],
};

const COPY = {
  zh: {
    audioName: "音乐",
    emptyComment: "暂无点评。",
    regenerateFailed: "重新生成失败",
    feedbackFailed: "反馈提交失败",
    overviewTitle: "生成依据",
    overviewText: "查看你的画面、共创线索与音乐家视角如何进入这幅画。",
    collapse: "收起",
    generatedAt: "生成时间",
    imageSource: "画面来源",
    sourceValue: "音乐 + 共创对话 + 你的画面",
    guideCount: "导览数量",
    modelStatus: "模型状态",
    generated: "已生成",
    userAnchor: "你的画面",
    coCreationClues: "共创线索",
    musicianClues: "音乐家视角",
    noRationale: "当前结果来自旧版流程，暂无逐项来源记录。",
    fieldLabels: {
      subject: "主体",
      space: "空间",
      composition: "构图",
      motion: "动势",
      materials: "材质",
      palette: "色彩",
      lighting: "光线",
      atmosphere: "氛围",
      personalMeaning: "个人意义",
      mustInclude: "必须保留",
      mustAvoid: "需要避开",
    },
    overviewRail: "生成依据",
    title: "画作已生成",
    subtitle: "来自音乐、共创对话和你的画面",
    regenerate: "重新生成",
    regenerateTip: "用同一提示重新生成",
    save: "保存画作",
    imageAlt: "AI 生成的画作",
    clickMusic: "点击播放音乐",
    playingWithImage: "正在随画面播放",
    clickAudio: "点击播放音频",
    collapsePlayerTip: "收起播放控制",
    expandControl: "展开播放控制",
    musicPlaying: "音乐播放中",
    expandProgressTip: "展开音乐播放进度",
    reviewTitle: "音乐家点评回顾",
    collected: "已收集",
    appendix: "研究附录",
    feedbackTitle: "这张图像符合你的听感吗？",
    commentMatch: "体现点评",
    aesthetic: "画面好看",
    feedbackPlaceholder: "补充一句你的感受（可选）",
    submitting: "提交中...",
    saved: "已记录",
    submit: "提交反馈",
    feedbackError: "反馈提交失败，请稍后重试",
    debug: "生成调试信息",
    notRecorded: "未记录",
    startOver: "重新开始",
    startOverTip: "清空当前流程，回到首页",
    replayTitle: "共同聆听的回声",
    you: "你",
    facilitator: "共创引导",
    overview: "查看生成依据",
    studyEvaluationTitle: "先看这幅生成作品",
    studyEvaluationIntro: "请根据此刻的真实感受逐项评分，提交后可查看同一段音乐直接生成的参照作品。",
    degreeScale: "1 表示很低，5 表示很高。",
    musicMatch: "音乐与画面的匹配程度",
    imaginationMatch: "画面与我脑海中想象的接近程度",
    agency: "我对画面内容产生影响的程度",
    ownership: "我把这幅画视为自己参与完成作品的程度",
    immersion: "整个过程让我专注于音乐与画面的程度",
    satisfaction: "这幅画作为本次体验结果让我满意的程度",
    continueComparison: "提交并查看参照作品",
    comparisonTitle: "对比两种生成结果",
    comparisonIntro: "切换查看共创作品与仅依据音乐分析生成的作品，再根据真实感受作答。",
    comparisonMusic: "哪幅更贴近音乐",
    comparisonImagination: "哪幅更贴近我的想象",
    comparisonOverall: "总体更喜欢哪幅",
    coCreatedChoice: "共创作品",
    baselineChoice: "音乐直生",
    same: "差不多",
    comparisonReason: "简单说说你判断的原因",
    submitComparison: "提交对比",
    manipulationTitle: "最后回顾刚才的过程",
    manipulationIntro: "请评价实际体验本身，无需猜测系统采用了哪种方式。",
    agreementScale: "1 表示完全不同意，5 表示完全同意。",
    perspectiveMultiplicity: "我感受到了多个彼此不同的听觉视角",
    articulationSupport: "引导帮助我逐步说清脑海中的画面",
    dialogueExperience: "整个过程更接近共同讨论，而不是填写画面参数",
    submitManipulation: "完成评价",
    baselinePending: "参照作品仍在生成，请稍候",
    baselineFailed: "参照作品生成失败",
    retryBaseline: "重新生成参照作品",
    evaluationError: "评价保存失败，请稍后重试",
    viewCoCreated: "共创作品",
    viewBaseline: "音乐直生作品",
    imageLoading: "作品加载中",
    imageLoadFailed: "作品加载失败，请重新切换后再试",
  },
  en: {
    audioName: "Music",
    emptyComment: "No comment yet.",
    regenerateFailed: "Regeneration failed",
    feedbackFailed: "Failed to submit feedback",
    overviewTitle: "Generation Rationale",
    overviewText: "See how your image, co-created cues, and musician perspectives shaped this artwork.",
    collapse: "Close",
    generatedAt: "Generated",
    imageSource: "Source",
    sourceValue: "Music + co-creation + your image",
    guideCount: "Guides",
    modelStatus: "Model",
    generated: "Generated",
    userAnchor: "Your Image",
    coCreationClues: "Co-created Cues",
    musicianClues: "Musician Perspectives",
    noRationale: "This result came from the legacy flow and has no field-level source record.",
    fieldLabels: {
      subject: "Subject",
      space: "Space",
      composition: "Composition",
      motion: "Motion",
      materials: "Materials",
      palette: "Color",
      lighting: "Lighting",
      atmosphere: "Atmosphere",
      personalMeaning: "Personal Meaning",
      mustInclude: "Must Include",
      mustAvoid: "Must Avoid",
    },
    overviewRail: "Overview",
    title: "Artwork Generated",
    subtitle: "Built from the music, co-created conversation, and your image",
    regenerate: "Regenerate",
    regenerateTip: "Regenerate with the same prompt",
    save: "Save artwork",
    imageAlt: "AI-generated artwork",
    clickMusic: "Click to play music",
    playingWithImage: "Playing with the artwork",
    clickAudio: "Click to play audio",
    collapsePlayerTip: "Hide playback controls",
    expandControl: "Show playback controls",
    musicPlaying: "Music playing",
    expandProgressTip: "Show music progress",
    reviewTitle: "Musician Comment Recap",
    collected: "Collected",
    appendix: "Research Appendix",
    feedbackTitle: "Does this image match what you heard?",
    commentMatch: "Reflects comments",
    aesthetic: "Looks good",
    feedbackPlaceholder: "Add one more thought (optional)",
    submitting: "Submitting...",
    saved: "Saved",
    submit: "Submit feedback",
    feedbackError: "Feedback failed. Please try again later.",
    debug: "Generation Debug Info",
    notRecorded: "Not recorded",
    startOver: "Start over",
    startOverTip: "Clear this flow and return home",
    replayTitle: "Echoes from the shared listening",
    you: "You",
    facilitator: "Co-creation guide",
    overview: "View generation rationale",
    studyEvaluationTitle: "First, consider this generated artwork",
    studyEvaluationIntro: "Rate your immediate response. You can view a reference generated directly from the same music after submitting.",
    degreeScale: "1 means very low and 5 means very high.",
    musicMatch: "Degree of match between the music and artwork",
    imaginationMatch: "Degree of match with what I imagined",
    agency: "Degree to which my input affected the artwork",
    ownership: "Degree to which I regard this as a work I helped create",
    immersion: "Degree to which the process focused me on music and imagery",
    satisfaction: "Degree of satisfaction with this artwork as the outcome",
    continueComparison: "Submit and view reference",
    comparisonTitle: "Compare the two generation results",
    comparisonIntro: "Switch between the co-created artwork and the music-only generation, then answer from your actual response.",
    comparisonMusic: "Which better matches the music",
    comparisonImagination: "Which better matches what I imagined",
    comparisonOverall: "Which do you prefer overall",
    coCreatedChoice: "Co-created",
    baselineChoice: "Music-only",
    same: "About the same",
    comparisonReason: "Briefly explain your choice",
    submitComparison: "Submit comparison",
    manipulationTitle: "Finally, reflect on the process",
    manipulationIntro: "Rate the experience itself without trying to infer how the system was implemented.",
    agreementScale: "1 means strongly disagree and 5 means strongly agree.",
    perspectiveMultiplicity: "I encountered multiple distinct listening perspectives",
    articulationSupport: "The guidance helped me articulate the image in my mind",
    dialogueExperience: "The process felt more like a shared discussion than filling in image parameters",
    submitManipulation: "Complete evaluation",
    baselinePending: "The reference artwork is still generating",
    baselineFailed: "Reference generation failed",
    retryBaseline: "Retry reference generation",
    evaluationError: "Evaluation could not be saved. Please try again.",
    viewCoCreated: "Co-created",
    viewBaseline: "Music-only",
    imageLoading: "Loading artwork",
    imageLoadFailed: "Artwork failed to load. Switch away and try again.",
  },
};

function getInitialResultState() {
  if (typeof window === "undefined") {
    return {
      imageUrl: null as string | null,
      audioUrl: "",
      audioName: "音乐",
      comments: {} as Record<string, string>,
      presets: null as { style: string; mood: string; tone: string } | null,
      characterIds: [] as string[],
      debugInfo: null as DebugInfo | null,
      negativePrompt: "",
      visualBrief: null as VisualBrief | null,
      conversationState: null as ConversationState | null,
      musicProfile: null as MusicProfile | null,
      studyTrial: null as StudyTrial | null,
      generatedTime: "",
    };
  }

  const imageUrl = sessionStorage.getItem("generatedImageUrl");
  const comments = JSON.parse(sessionStorage.getItem("comments") || "{}") as Record<string, string>;
  const presets = JSON.parse(sessionStorage.getItem("imagePresets") || "null") as { style: string; mood: string; tone: string } | null;
  const characterIds = JSON.parse(sessionStorage.getItem("selectedCharacters") || "[]") as string[];
  const musicAnalysis = JSON.parse(sessionStorage.getItem("musicAnalysis") || "{}");
  const prompt = sessionStorage.getItem("generatedImagePrompt") || "";
  const negativePrompt = sessionStorage.getItem("generatedNegativePrompt") || "";
  const remoteImageUrl = sessionStorage.getItem("generatedRemoteImageUrl") || "";
  const meta = JSON.parse(sessionStorage.getItem("imageGenerationMeta") || "null") as GenerationMeta | null;
  const audioUrl = sessionStorage.getItem("audioSrc") || sessionStorage.getItem("audioObjectUrl") || "";
  const audioName = (sessionStorage.getItem("audioFileName") || "音乐").replace(/\.\w+$/, "");
  const visualBrief = JSON.parse(sessionStorage.getItem("visualBrief") || "null") as VisualBrief | null;
  const conversationState = JSON.parse(sessionStorage.getItem("conversationState") || "null") as ConversationState | null;
  const musicProfile = JSON.parse(sessionStorage.getItem("musicProfile") || "null") as MusicProfile | null;
  const studyTrial = JSON.parse(sessionStorage.getItem("studyTrial") || "null") as StudyTrial | null;
  const usePreviewData = !imageUrl && window.location.search.includes("page05-gallery-result");

  return {
    imageUrl: imageUrl || (usePreviewData ? "/preview/cinema-landscape.jpg" : null),
    audioUrl: audioUrl || (usePreviewData ? "/preset-audio/music2image.mp3" : ""),
    audioName: audioName || "音乐",
    comments: usePreviewData
      ? {
          boya: "此曲有山风，竟若泉涌，弦外之音尚浅。",
          beethoven: "这里和命运搏斗的声音在推进，节奏里有不甘的意志。",
          abing: "这曲子急，像赶末班车。但太亮了，少了点嚼过苦的泥。",
          armstrong: "哟，这曲子跑得欢，亮堂堂的，有劲儿，节奏踩得稳。",
        }
      : comments,
    presets: presets || (usePreviewData ? { style: "水墨", mood: "激昂", tone: "暖色" } : null),
    characterIds: characterIds.length > 0 || !usePreviewData
      ? characterIds
      : ["boya", "beethoven", "abing", "armstrong"],
    debugInfo: {
      musicAnalysis: usePreviewData ? { tempo: "快速", energy: "高", brightness: "明亮", mood: "激昂" } : musicAnalysis,
      prompt: prompt || (usePreviewData ? "预览模式示例数据，用于查看第五页版式。" : ""),
      meta: meta || (usePreviewData ? { runId: "preview-run", sessionId: "preview-session", model: "preview" } : null),
      remoteImageUrl,
    },
    negativePrompt,
    visualBrief,
    conversationState,
    musicProfile,
    studyTrial,
    generatedTime: new Date().toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function getCharacterView(character: Character, language: Language) {
  return characterUi[language][character.id as keyof typeof characterUi.zh] || { name: character.name, focus: character.focusDescription };
}

function briefFieldText(
  brief: VisualBrief | null,
  field: VisualBriefFieldKey,
  fallback: string
) {
  const value = brief?.fields[field].value;
  if (Array.isArray(value)) return value.join(" · ");
  return value || fallback;
}

function ScoreRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (score: number) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs text-[#d7b99b]">{label}</p>
      <div className="grid grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            type="button"
            onClick={() => onChange(score)}
            aria-pressed={value === score}
            className={`h-8 border text-xs font-semibold transition ${
              value === score
                ? "border-[#ffd083] bg-[#ffd083] text-[#2b2230]"
                : "border-[#8f6b52]/44 bg-[#211b25] text-[#c8aa8e] hover:border-[#ffd083]/70"
            }`}
          >
            {score}
          </button>
        ))}
      </div>
    </div>
  );
}

function ComparisonChoiceRow({
  label,
  value,
  sameLabel,
  coCreatedLabel,
  baselineLabel,
  onChange,
}: {
  label: string;
  value: ComparisonChoice | null;
  sameLabel: string;
  coCreatedLabel: string;
  baselineLabel: string;
  onChange: (choice: ComparisonChoice) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs text-[#d7b99b]">{label}</p>
      <div className="grid grid-cols-3 gap-1.5">
        {(["co_created", "direct_baseline", "tie"] as ComparisonChoice[]).map((choice) => (
          <button
            key={choice}
            type="button"
            onClick={() => onChange(choice)}
            aria-pressed={value === choice}
            className={`h-8 border text-xs font-semibold transition ${
              value === choice
                ? "border-[#ffd083] bg-[#ffd083] text-[#2b2230]"
                : "border-[#8f6b52]/44 bg-[#211b25] text-[#c8aa8e] hover:border-[#ffd083]/70"
            }`}
          >
            {choice === "tie"
              ? sameLabel
              : choice === "co_created"
                ? coCreatedLabel
                : baselineLabel}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ResultPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const copy = COPY[language];
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const resultViewRecordedRef = useRef(false);
  const comparisonExposureRecordedRef = useRef(false);
  const baselinePreloadOutcomesRef = useRef(new Set<string>());
  const displayedImageLoadStartedAtRef = useRef<number | null>(null);
  const mounted = useHydrated();
  const [initialState] = useState(getInitialResultState);
  const [imageUrl, setImageUrl] = useState<string | null>(initialState.imageUrl);
  const [audioUrl] = useState<string>(initialState.audioUrl);
  const [audioName] = useState<string>(initialState.audioName);
  const [comments] = useState<Record<string, string>>(initialState.comments);
  const [presets] = useState<{ style: string; mood: string; tone: string } | null>(initialState.presets);
  const [characterIds] = useState<string[]>(initialState.characterIds);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(initialState.debugInfo);
  const [negativePrompt] = useState(initialState.negativePrompt);
  const [visualBrief] = useState(initialState.visualBrief);
  const [conversationState] = useState(initialState.conversationState);
  const [musicProfile] = useState(initialState.musicProfile);
  const [studyTrial, setStudyTrial] = useState(initialState.studyTrial);
  const [generatedTime] = useState(initialState.generatedTime);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showOverview, setShowOverview] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const [showAppendix, setShowAppendix] = useState(false);
  const [pausedDanmakuLane, setPausedDanmakuLane] = useState<number | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>({
    musicMatchScore: 4,
    commentMatchScore: 4,
    aestheticScore: 4,
    selectedReasons: [],
    freeText: "",
  });
  const [feedbackStatus, setFeedbackStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [studyPhase, setStudyPhase] = useState<StudyPhase>(initialState.studyTrial ? "artwork" : "completed");
  const [baselineStatus, setBaselineStatus] = useState<"pending" | "running" | "completed" | "failed">("pending");
  const [baselineResult, setBaselineResult] = useState<BaselineResult | null>(null);
  const [studyRatings, setStudyRatings] = useState<Record<RatingKey, number | null>>({
    musicMatchScore: null,
    imaginationMatchScore: null,
    agencyScore: null,
    ownershipScore: null,
    immersionScore: null,
    satisfactionScore: null,
  });
  const [comparison, setComparison] = useState<{
    musicMatchChoice: ComparisonChoice | null;
    imaginationMatchChoice: ComparisonChoice | null;
    overallChoice: ComparisonChoice | null;
    reason: string;
  }>({
    musicMatchChoice: null,
    imaginationMatchChoice: null,
    overallChoice: null,
    reason: "",
  });
  const [manipulationRatings, setManipulationRatings] = useState<Record<ManipulationKey, number | null>>({
    perspectiveMultiplicityScore: null,
    articulationSupportScore: null,
    dialogueExperienceScore: null,
  });
  const [studySaving, setStudySaving] = useState(false);
  const [studyError, setStudyError] = useState("");
  const [resultArtworkRole, setResultArtworkRole] = useState<GenerationRole>("co_created");
  const [resultImageStatus, setResultImageStatus] = useState<"loading" | "loaded" | "error">("loading");

  useEffect(() => {
    if (!imageUrl) {
      router.push("/");
      return;
    }
    if (resultViewRecordedRef.current) return;
    resultViewRecordedRef.current = true;
    recordExperimentEvent("result-viewed", "/result", {
      runId: initialState.debugInfo?.meta?.runId || null,
      trialId: initialState.studyTrial?.id || null,
      condition: initialState.studyTrial?.condition || null,
    });
  }, [imageUrl, initialState.debugInfo?.meta?.runId, initialState.studyTrial?.condition, initialState.studyTrial?.id, router]);

  const studyTrialId = studyTrial?.id;

  useEffect(() => {
    if (!studyTrialId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const refresh = async () => {
      try {
        const [baselineResponse, evaluationResponse] = await Promise.all([
          fetch(`/api/experiment/baseline?trialId=${encodeURIComponent(studyTrialId)}`, { cache: "no-store" }),
          fetch(`/api/experiment/evaluation?trialId=${encodeURIComponent(studyTrialId)}`, { cache: "no-store" }),
        ]);
        const baselineData = await baselineResponse.json();
        const evaluationData = await evaluationResponse.json();
        if (!active) return;
        if (baselineResponse.ok) {
          if (baselineData.trial) {
            setStudyTrial(baselineData.trial as StudyTrial);
            sessionStorage.setItem("studyTrial", JSON.stringify(baselineData.trial));
          }
          setBaselineStatus(baselineData.job?.status || "pending");
          setBaselineResult(baselineData.result || null);
        }
        if (evaluationResponse.ok) {
          const restoredScore = (value: unknown) => {
            const parsed = Number(value);
            return Number.isInteger(parsed) && parsed >= 1 && parsed <= 5 ? parsed : null;
          };
          if (evaluationData.manipulation) {
            setStudyPhase("completed");
            setManipulationRatings({
              perspectiveMultiplicityScore: restoredScore(evaluationData.manipulation.perspective_multiplicity_score),
              articulationSupportScore: restoredScore(evaluationData.manipulation.articulation_support_score),
              dialogueExperienceScore: restoredScore(evaluationData.manipulation.dialogue_experience_score),
            });
          } else if (evaluationData.labeledComparison) {
            setStudyPhase("manipulation");
            setComparison({
              musicMatchChoice: evaluationData.labeledComparison.music_match_choice as ComparisonChoice,
              imaginationMatchChoice: evaluationData.labeledComparison.imagination_match_choice as ComparisonChoice,
              overallChoice: evaluationData.labeledComparison.overall_choice as ComparisonChoice,
              reason: String(evaluationData.labeledComparison.reason || ""),
            });
          } else if (evaluationData.comparison) {
            setStudyPhase("completed");
          } else if (evaluationData.artwork) {
            setStudyPhase("comparison");
            setStudyRatings({
              musicMatchScore: restoredScore(evaluationData.artwork.music_match_score),
              imaginationMatchScore: restoredScore(evaluationData.artwork.imagination_match_score),
              agencyScore: restoredScore(evaluationData.artwork.agency_score),
              ownershipScore: restoredScore(evaluationData.artwork.ownership_score),
              immersionScore: restoredScore(evaluationData.artwork.immersion_score),
              satisfactionScore: restoredScore(evaluationData.artwork.satisfaction_score),
            });
          }
        }
        if (active && baselineData.job?.status !== "completed" && baselineData.job?.status !== "failed") {
          timer = setTimeout(refresh, 2500);
        }
      } catch {
        if (active) timer = setTimeout(refresh, 3500);
      }
    };

    void refresh();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [studyTrialId]);

  useEffect(() => {
    const baselineImageUrl = baselineResult?.imageUrl;
    if (!baselineImageUrl || baselinePreloadOutcomesRef.current.has(baselineImageUrl)) return;

    const startedAt = Date.now();
    const image = new window.Image();
    image.onload = () => {
      if (baselinePreloadOutcomesRef.current.has(baselineImageUrl)) return;
      baselinePreloadOutcomesRef.current.add(baselineImageUrl);
      recordExperimentEvent("result-image-preload-completed", "/result", {
        trialId: studyTrialId || null,
        runId: baselineResult.runId,
        role: "direct_baseline",
        loadMs: Date.now() - startedAt,
      });
    };
    image.onerror = () => {
      if (baselinePreloadOutcomesRef.current.has(baselineImageUrl)) return;
      baselinePreloadOutcomesRef.current.add(baselineImageUrl);
      recordExperimentEvent("result-image-preload-failed", "/result", {
        trialId: studyTrialId || null,
        runId: baselineResult.runId,
        role: "direct_baseline",
        loadMs: Date.now() - startedAt,
      });
    };
    image.src = baselineImageUrl;

    return () => {
      image.onload = null;
      image.onerror = null;
    };
  }, [baselineResult?.imageUrl, baselineResult?.runId, studyTrialId]);

  useEffect(() => {
    if (
      !studyTrialId ||
      studyPhase !== "comparison" ||
      baselineStatus !== "completed" ||
      !baselineResult?.imageUrl ||
      comparisonExposureRecordedRef.current
    ) return;
    comparisonExposureRecordedRef.current = true;
    recordExperimentEvent("labeled-baseline-comparison-exposed", "/result", {
      trialId: studyTrialId,
      condition: studyTrial?.condition,
    });
  }, [baselineResult?.imageUrl, baselineStatus, studyPhase, studyTrial?.condition, studyTrialId]);

  const playResultAudio = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      audio.loop = true;
      await audio.play();
      setIsAudioPlaying(true);
      setAudioBlocked(false);
    } catch {
      setIsAudioPlaying(false);
      setAudioBlocked(true);
    }
  }, []);

  const toggleAudio = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isAudioPlaying) {
      audio.pause();
      setIsAudioPlaying(false);
      return;
    }

    await playResultAudio();
  };

  const handleStartOver = () => {
    recordExperimentEvent("flow-restarted", "/result", {
      runId: debugInfo?.meta?.runId || null,
    });
    sessionStorage.clear();
    router.push("/");
  };

  const handleRegenerateArtwork = async () => {
    const prompt = debugInfo?.prompt?.trim();
    if (!prompt || regenerating) return;

    setRegenerating(true);
    setRegenerateError(null);
    recordExperimentEvent("regeneration-started", "/result", {
      runId: debugInfo?.meta?.runId || null,
    });

    try {
      const sessionId =
        debugInfo?.meta?.sessionId ||
        sessionStorage.getItem("experimentSessionId") ||
        (await getExperimentSessionId());
      const commentList = characterIds
        .filter((characterId) => comments[characterId])
        .map((characterId) => ({
          characterId,
          text: comments[characterId],
        }));
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trialId: studyTrial?.id,
          generationRole: "co_created",
          condition: studyTrial?.condition || conversationState?.condition || "multi_agent",
          sessionId,
          selectedCharacters: characterIds,
          comments: commentList,
          presets,
          userNote: sessionStorage.getItem("userNote") || "",
          musicAnalysis: debugInfo?.musicAnalysis || {},
          promptOverride: prompt,
          negativePrompt,
          ...(visualBrief && conversationState
            ? { visualBrief, conversationState, musicProfile }
            : {}),
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.imageUrl) {
        throw new Error(data.detail || data.error || copy.regenerateFailed);
      }

      displayedImageLoadStartedAtRef.current = null;
      setResultImageStatus("loading");
      setImageUrl(data.imageUrl);
      const nextDebugInfo: DebugInfo = {
        musicAnalysis: debugInfo?.musicAnalysis,
        prompt: data.prompt || prompt,
        remoteImageUrl: data.remoteImageUrl || "",
        meta: {
          runId: data.runId,
          sessionId: data.sessionId || sessionId,
          provider: data.provider,
          model: data.model,
          imageSize: data.imageSize,
          requestId: data.requestId,
          promptSource: data.promptSource,
          promptDirector: debugInfo?.meta?.promptDirector || data.promptDirector,
          logPath: data.logPath,
          timings: data.timings,
          usage: data.usage,
        },
      };
      setDebugInfo(nextDebugInfo);
      sessionStorage.setItem("generatedImageUrl", data.imageUrl);
      sessionStorage.setItem("generatedRemoteImageUrl", data.remoteImageUrl || "");
      sessionStorage.setItem("generatedImagePrompt", data.prompt || prompt);
      sessionStorage.setItem("generatedNegativePrompt", data.negativePrompt || negativePrompt);
      sessionStorage.setItem("experimentSessionId", data.sessionId || sessionId);
      sessionStorage.setItem("imageGenerationMeta", JSON.stringify(nextDebugInfo.meta));
    } catch (error) {
      setRegenerateError(error instanceof Error ? error.message : copy.regenerateFailed);
    } finally {
      setRegenerating(false);
    }
  };

  const updateScore = (
    key: keyof Pick<FeedbackState, "musicMatchScore" | "commentMatchScore" | "aestheticScore">,
    score: number
  ) => {
    setFeedback((prev) => ({ ...prev, [key]: score }));
  };

  const toggleReason = (reason: string) => {
    setFeedback((prev) => ({
      ...prev,
      selectedReasons: prev.selectedReasons.includes(reason)
        ? prev.selectedReasons.filter((item) => item !== reason)
        : [...prev.selectedReasons, reason],
    }));
  };

  const submitFeedback = async () => {
    const runId = debugInfo?.meta?.runId;
    if (!runId || feedbackStatus === "saving" || feedbackStatus === "saved") return;

    setFeedbackStatus("saving");

    try {
      const sessionId =
        debugInfo?.meta?.sessionId ||
        sessionStorage.getItem("experimentSessionId") ||
        (await getExperimentSessionId());
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId,
          sessionId,
          ...feedback,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || copy.feedbackFailed);
      }

      setFeedbackStatus("saved");
    } catch {
      setFeedbackStatus("error");
    }
  };

  const submitArtworkEvaluation = async () => {
    if (!studyTrial || studySaving || Object.values(studyRatings).some((value) => value === null)) return;
    setStudySaving(true);
    setStudyError("");
    try {
      const response = await fetch("/api/experiment/evaluation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: "artwork",
          trialId: studyTrial.id,
          ...studyRatings,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || copy.evaluationError);
      setStudyPhase("comparison");
      recordExperimentEvent("artwork-evaluation-submitted", "/result", {
        trialId: studyTrial.id,
        condition: studyTrial.condition,
      });
    } catch (error) {
      setStudyError(error instanceof Error ? error.message : copy.evaluationError);
    } finally {
      setStudySaving(false);
    }
  };

  const submitComparison = async () => {
    if (
      !studyTrial ||
      !comparison.musicMatchChoice ||
      !comparison.imaginationMatchChoice ||
      !comparison.overallChoice ||
      studySaving
    ) return;
    setStudySaving(true);
    setStudyError("");
    try {
      const response = await fetch("/api/experiment/evaluation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: "comparison",
          trialId: studyTrial.id,
          musicMatchChoice: comparison.musicMatchChoice,
          imaginationMatchChoice: comparison.imaginationMatchChoice,
          overallChoice: comparison.overallChoice,
          reason: comparison.reason,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || copy.evaluationError);
      setStudyPhase("manipulation");
      recordExperimentEvent("labeled-baseline-comparison-submitted", "/result", {
        trialId: studyTrial.id,
        condition: studyTrial.condition,
      });
    } catch (error) {
      setStudyError(error instanceof Error ? error.message : copy.evaluationError);
    } finally {
      setStudySaving(false);
    }
  };

  const submitManipulationCheck = async () => {
    if (
      !studyTrial ||
      studySaving ||
      Object.values(manipulationRatings).some((value) => value === null)
    ) return;
    setStudySaving(true);
    setStudyError("");
    try {
      const response = await fetch("/api/experiment/evaluation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: "manipulation",
          trialId: studyTrial.id,
          ...manipulationRatings,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || copy.evaluationError);
      setStudyPhase("completed");
      const completedTrial = { ...studyTrial, status: "completed" as const };
      setStudyTrial(completedTrial);
      sessionStorage.setItem("studyTrial", JSON.stringify(completedTrial));
      recordExperimentEvent("manipulation-check-submitted", "/result", {
        trialId: studyTrial.id,
        condition: studyTrial.condition,
      });
    } catch (error) {
      setStudyError(error instanceof Error ? error.message : copy.evaluationError);
    } finally {
      setStudySaving(false);
    }
  };

  const retryBaseline = async () => {
    if (!studyTrial || !musicProfile || studySaving) return;
    setStudySaving(true);
    setStudyError("");
    setBaselineStatus("running");
    try {
      const result = await startDirectBaseline({
        trial: studyTrial,
        musicProfile,
        musicAnalysis: (debugInfo?.musicAnalysis || {}) as Record<string, unknown>,
      });
      if (result?.imageUrl) {
        setBaselineResult(result as BaselineResult);
        setBaselineStatus("completed");
      }
    } catch (error) {
      setBaselineStatus("failed");
      setStudyError(error instanceof Error ? error.message : copy.baselineFailed);
    } finally {
      setStudySaving(false);
    }
  };

  const handleSelectResultArtwork = (role: GenerationRole, startedAt: number) => {
    if (role === resultArtworkRole) return;
    displayedImageLoadStartedAtRef.current = startedAt;
    setResultImageStatus("loading");
    setResultArtworkRole(role);
    recordExperimentEvent("result-artwork-switched", "/result", {
      trialId: studyTrial?.id || null,
      role,
    });
  };

  const handleResultImageLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const startedAt = displayedImageLoadStartedAtRef.current;
    displayedImageLoadStartedAtRef.current = null;
    setResultImageStatus("loaded");
    recordExperimentEvent("result-image-loaded", "/result", {
      trialId: studyTrial?.id || null,
      runId:
        resultArtworkRole === "direct_baseline"
          ? baselineResult?.runId || null
          : debugInfo?.meta?.runId || null,
      role: resultArtworkRole,
      loadMs: startedAt === null ? null : Math.max(0, Math.round(event.timeStamp - startedAt)),
    });
    void playResultAudio();
  };

  const handleResultImageError = (event: SyntheticEvent<HTMLImageElement>) => {
    const startedAt = displayedImageLoadStartedAtRef.current;
    displayedImageLoadStartedAtRef.current = null;
    setResultImageStatus("error");
    recordExperimentEvent("result-image-load-failed", "/result", {
      trialId: studyTrial?.id || null,
      runId:
        resultArtworkRole === "direct_baseline"
          ? baselineResult?.runId || null
          : debugInfo?.meta?.runId || null,
      role: resultArtworkRole,
      loadMs: startedAt === null ? null : Math.max(0, Math.round(event.timeStamp - startedAt)),
    });
  };

  if (!mounted || !imageUrl) return null;

  const characters = getCharactersByIds(characterIds);
  const commentsForDebug = characterIds.map((characterId) => ({
    characterId,
    characterName: characters.find((char) => char.id === characterId)?.name || characterId,
    text: comments[characterId] || "",
  }));
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const promptDirectorResult = debugInfo?.meta?.promptDirector?.result || null;
  const userRationale = promptDirectorResult?.userSourceMappings || [];
  const briefRationale = promptDirectorResult?.visualBriefMappings || [];
  const musicianRationale = promptDirectorResult?.sourceMappings || [];
  const conversationUserMessages = conversationState?.messages.filter(
    (message) => message.role === "user"
  ) || [];
  const hasRationale = userRationale.length + briefRationale.length + musicianRationale.length > 0;
  const replayMessages = conversationState?.messages
    .filter((message) => (["musician", "guide", "user"].includes(message.role)) && message.content.trim())
    .map((message) => {
      const speakerCharacter = characters.find((character) => character.id === message.speakerId);
      return {
        id: message.id,
        speaker: message.role === "user"
          ? copy.you
          : speakerCharacter
            ? getCharacterView(speakerCharacter, language).name
            : message.role === "guide"
              ? copy.facilitator
              : message.speakerId,
        content: message.content,
        role: message.role,
      };
    }) || [];
  const danmakuMessages = replayMessages.length > 0
    ? replayMessages
    : characters.flatMap((character) => comments[character.id]
      ? [{
          id: `comment-${character.id}`,
          speaker: getCharacterView(character, language).name,
          content: comments[character.id],
          role: "musician" as const,
        }]
      : []);
  const danmakuLanes = [
    danmakuMessages.filter((_, index) => index % 2 === 0),
    danmakuMessages.filter((_, index) => index % 2 === 1),
  ].filter((lane) => lane.length > 0);
  const studyLocked = Boolean(studyTrial && studyPhase !== "completed");
  const pairedArtworkReady = baselineStatus === "completed" && Boolean(baselineResult?.imageUrl);
  const comparisonReady = studyPhase === "comparison" && pairedArtworkReady;
  const canSwitchPairedArtwork = Boolean(
    studyTrial &&
    studyPhase !== "artwork" &&
    pairedArtworkReady
  );
  const displayedResultImage = canSwitchPairedArtwork && resultArtworkRole === "direct_baseline"
    ? baselineResult?.imageUrl || imageUrl
    : imageUrl;

  return (
    <main className="relative h-screen overflow-hidden bg-[#111019] text-[#f8dfbb]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_46%,rgba(208,139,74,0.18),transparent_38%),linear-gradient(135deg,#0d1019_0%,#241f2b_48%,#0c0e16_100%)]" />
      <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(115deg,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(25deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:190px_190px,230px_230px]" />

      <div className="relative z-10 flex h-screen flex-col px-4 py-3 lg:px-6 lg:py-4 2xl:px-12 2xl:py-5">
        <FlowHeader activeStep={4} compact />
        <section className="relative mt-2 min-h-0 flex-1 overflow-hidden rounded-[20px] border border-[#9f6f45]/46 bg-[#1d1923]/34 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">

          {!studyLocked && <div className="absolute right-5 top-4 z-50 flex gap-3">
              <div className="group relative">
                <button
                  type="button"
                  onClick={handleRegenerateArtwork}
                  disabled={regenerating || !debugInfo?.prompt}
                  aria-label={copy.regenerate}
                  title={copy.regenerateTip}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-[#ffd083]/42 bg-[#1f1923]/78 text-[#ffe3bd] shadow-[0_12px_34px_rgba(0,0,0,0.34)] backdrop-blur transition hover:border-[#ffd083]/80 hover:bg-[#3a2d32] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <svg className={`h-5 w-5 ${regenerating ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" />
                  </svg>
                </button>
                <span className="pointer-events-none absolute left-1/2 top-[52px] z-40 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#a77b57]/44 bg-[#1f1923]/92 px-3 py-1.5 text-xs text-[#ffe3bd] opacity-0 shadow-[0_10px_24px_rgba(0,0,0,0.3)] transition group-hover:opacity-100">
                  {copy.regenerateTip}
                </span>
              </div>
              <div className="group relative">
                <a
                  href={displayedResultImage}
                  download={`melodyvision-${resultArtworkRole}-${debugInfo?.meta?.runId || "artwork"}.png`}
                  onClick={() => recordExperimentEvent("artwork-downloaded", "/result", {
                    runId: debugInfo?.meta?.runId || null,
                    role: resultArtworkRole,
                  })}
                  aria-label={copy.save}
                  title={copy.save}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-[#ffd083]/62 bg-[#4b3444]/86 text-[#ffe3bd] shadow-[0_12px_34px_rgba(0,0,0,0.34),0_0_20px_rgba(255,194,103,0.22)] backdrop-blur transition hover:border-[#ffd083] hover:bg-[#5a3b4d]"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v3h14v-3" />
                  </svg>
                </a>
                <span className="pointer-events-none absolute left-1/2 top-[52px] z-40 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#a77b57]/44 bg-[#1f1923]/92 px-3 py-1.5 text-xs text-[#ffe3bd] opacity-0 shadow-[0_10px_24px_rgba(0,0,0,0.3)] transition group-hover:opacity-100">
                  {copy.save}
                </span>
              </div>
          </div>}

          {!studyLocked && <button
            type="button"
            onClick={() => {
              setShowOverview(true);
              recordExperimentEvent("rationale-opened", "/result", {
                runId: debugInfo?.meta?.runId || null,
              });
            }}
            aria-label={copy.overview}
            title={copy.overview}
            className="absolute left-5 top-4 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-[#ffd083]/42 bg-[#1f1923]/78 text-lg text-[#ffe3bd] shadow-[0_12px_34px_rgba(0,0,0,0.34)] backdrop-blur transition hover:border-[#ffd083]/80 hover:bg-[#3a2d32]"
          >
            ↗
          </button>}

          {regenerateError && (
            <p className="absolute left-1/2 top-16 z-50 -translate-x-1/2 text-xs text-[#ff9f9f]">{regenerateError}</p>
          )}

          <div className={`absolute bottom-[96px] top-[56px] flex items-center justify-center xl:top-3 ${studyLocked ? "left-6 right-[338px]" : "inset-x-6"}`}>
            <div className="relative flex h-full w-full items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={`${resultArtworkRole}:${displayedResultImage}`}
                src={displayedResultImage}
                alt={copy.imageAlt}
                className={`block max-h-full max-w-full rounded-[6px] object-contain shadow-[0_34px_110px_rgba(0,0,0,0.62),0_0_45px_rgba(255,187,91,0.16)] ring-1 ring-[#efbd77]/38 transition-opacity duration-200 ${
                  resultImageStatus === "loading" ? "opacity-0" : "opacity-100"
                }`}
                onLoad={handleResultImageLoad}
                onError={handleResultImageError}
              />
              {resultImageStatus === "loading" && (
                <div className="absolute inset-0 flex items-center justify-center" role="status" aria-live="polite">
                  <div className="flex items-center gap-3 border border-[#a77b57]/44 bg-[#1f1923]/88 px-4 py-3 text-sm text-[#ffe3bd] shadow-[0_14px_36px_rgba(0,0,0,0.34)] backdrop-blur">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#ffd083]/30 border-t-[#ffd083]" />
                    {copy.imageLoading}
                  </div>
                </div>
              )}
              {resultImageStatus === "error" && (
                <div className="absolute inset-0 flex items-center justify-center" role="alert">
                  <p className="border border-[#b76557]/56 bg-[#291d24]/92 px-4 py-3 text-sm text-[#efb6a5] shadow-[0_14px_36px_rgba(0,0,0,0.34)]">
                    {copy.imageLoadFailed}
                  </p>
                </div>
              )}
            </div>
          </div>

          {studyLocked && studyTrial && (
            <aside className="absolute bottom-4 right-4 top-4 z-[65] flex w-[306px] flex-col border border-[#a77b57]/48 bg-[#211c27]/96 p-5 shadow-[-18px_0_60px_rgba(0,0,0,0.42)] backdrop-blur-xl">
              {studyPhase === "artwork" ? (
                <>
                  <h2 className="font-serif text-lg font-semibold text-[#ffe3bd]">{copy.studyEvaluationTitle}</h2>
                  <p className="mt-2 text-xs leading-relaxed text-[#cdb297]">{copy.studyEvaluationIntro}</p>
                  <p className="mt-1.5 text-[11px] text-[#a98c72]">{copy.degreeScale}</p>
                  <div className="mt-5 flex-1 space-y-4 overflow-y-auto pr-1">
                    {([
                      ["musicMatchScore", copy.musicMatch],
                      ["imaginationMatchScore", copy.imaginationMatch],
                      ["agencyScore", copy.agency],
                      ["ownershipScore", copy.ownership],
                      ["immersionScore", copy.immersion],
                      ["satisfactionScore", copy.satisfaction],
                    ] as Array<[RatingKey, string]>).map(([key, label]) => (
                      <ScoreRow
                        key={key}
                        label={label}
                        value={studyRatings[key]}
                        onChange={(score) => setStudyRatings((current) => ({ ...current, [key]: score }))}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={submitArtworkEvaluation}
                    disabled={studySaving || Object.values(studyRatings).some((value) => value === null)}
                    className="mt-4 h-11 border border-[#ffd083]/58 bg-[#4b3444] px-4 text-sm font-semibold text-[#ffe3bd] transition hover:bg-[#5a3b4d] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {studySaving ? copy.submitting : copy.continueComparison}
                  </button>
                </>
              ) : studyPhase === "comparison" ? (
                <>
                  <h2 className="font-serif text-lg font-semibold text-[#ffe3bd]">{copy.comparisonTitle}</h2>
                  <p className="mt-2 text-xs leading-relaxed text-[#cdb297]">{copy.comparisonIntro}</p>
                  {baselineStatus === "failed" ? (
                    <div className="flex flex-1 flex-col items-center justify-center text-center">
                      <p className="text-sm text-[#efb6a5]">{copy.baselineFailed}</p>
                      <button
                        type="button"
                        onClick={retryBaseline}
                        disabled={studySaving}
                        className="mt-4 h-10 border border-[#ffd083]/58 px-4 text-xs font-semibold text-[#ffe3bd] hover:bg-[#4b3444] disabled:opacity-40"
                      >
                        {copy.retryBaseline}
                      </button>
                    </div>
                  ) : !comparisonReady ? (
                    <div className="flex flex-1 flex-col items-center justify-center text-center">
                      <div className="h-10 w-10 animate-spin rounded-full border border-[#a97950]/42 border-t-[#ffd083]" />
                      <p className="mt-4 text-sm text-[#d7b99b]">{copy.baselinePending}</p>
                    </div>
                  ) : (
                    <>
                      <div className="mt-5 flex-1 space-y-4 overflow-y-auto pr-1">
                        <ComparisonChoiceRow
                          label={copy.comparisonMusic}
                          value={comparison.musicMatchChoice}
                          sameLabel={copy.same}
                          coCreatedLabel={copy.coCreatedChoice}
                          baselineLabel={copy.baselineChoice}
                          onChange={(value) => setComparison((current) => ({ ...current, musicMatchChoice: value }))}
                        />
                        <ComparisonChoiceRow
                          label={copy.comparisonImagination}
                          value={comparison.imaginationMatchChoice}
                          sameLabel={copy.same}
                          coCreatedLabel={copy.coCreatedChoice}
                          baselineLabel={copy.baselineChoice}
                          onChange={(value) => setComparison((current) => ({ ...current, imaginationMatchChoice: value }))}
                        />
                        <ComparisonChoiceRow
                          label={copy.comparisonOverall}
                          value={comparison.overallChoice}
                          sameLabel={copy.same}
                          coCreatedLabel={copy.coCreatedChoice}
                          baselineLabel={copy.baselineChoice}
                          onChange={(value) => setComparison((current) => ({ ...current, overallChoice: value }))}
                        />
                        <textarea
                          value={comparison.reason}
                          onChange={(event) => setComparison((current) => ({ ...current, reason: event.target.value }))}
                          placeholder={copy.comparisonReason}
                          className="h-20 w-full resize-none border border-[#8f6b52]/44 bg-[#17131a] p-3 text-xs text-[#ffe3bd] outline-none placeholder:text-[#9f8066] focus:border-[#ffd083]/70"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={submitComparison}
                        disabled={
                          studySaving ||
                          !comparison.musicMatchChoice ||
                          !comparison.imaginationMatchChoice ||
                          !comparison.overallChoice
                        }
                        className="mt-4 h-11 border border-[#ffd083]/58 bg-[#4b3444] px-4 text-sm font-semibold text-[#ffe3bd] transition hover:bg-[#5a3b4d] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {studySaving ? copy.submitting : copy.submitComparison}
                      </button>
                    </>
                  )}
                </>
              ) : (
                <>
                  <h2 className="font-serif text-lg font-semibold text-[#ffe3bd]">{copy.manipulationTitle}</h2>
                  <p className="mt-2 text-xs leading-relaxed text-[#cdb297]">{copy.manipulationIntro}</p>
                  <p className="mt-1.5 text-[11px] text-[#a98c72]">{copy.agreementScale}</p>
                  <div className="mt-5 flex-1 space-y-5 overflow-y-auto pr-1">
                    {([
                      ["perspectiveMultiplicityScore", copy.perspectiveMultiplicity],
                      ["articulationSupportScore", copy.articulationSupport],
                      ["dialogueExperienceScore", copy.dialogueExperience],
                    ] as Array<[ManipulationKey, string]>).map(([key, label]) => (
                      <ScoreRow
                        key={key}
                        label={label}
                        value={manipulationRatings[key]}
                        onChange={(score) => setManipulationRatings((current) => ({ ...current, [key]: score }))}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={submitManipulationCheck}
                    disabled={studySaving || Object.values(manipulationRatings).some((value) => value === null)}
                    className="mt-4 h-11 border border-[#ffd083]/58 bg-[#4b3444] px-4 text-sm font-semibold text-[#ffe3bd] transition hover:bg-[#5a3b4d] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {studySaving ? copy.submitting : copy.submitManipulation}
                  </button>
                </>
              )}
              {studyError && <p className="mt-3 text-xs text-[#efb6a5]">{studyError}</p>}
            </aside>
          )}

          {canSwitchPairedArtwork && (
            <div className="absolute left-1/2 top-4 z-50 flex -translate-x-1/2 border border-[#a77b57]/44 bg-[#1f1923]/90 p-1 text-xs text-[#ffe3bd] shadow-[0_10px_28px_rgba(0,0,0,0.34)] backdrop-blur">
              {([
                ["co_created", copy.viewCoCreated],
                ["direct_baseline", copy.viewBaseline],
              ] as Array<[GenerationRole, string]>).map(([role, label]) => (
                <button
                  key={role}
                  type="button"
                  onClick={(event) => handleSelectResultArtwork(role, event.timeStamp)}
                  aria-pressed={resultArtworkRole === role}
                  className={`min-w-24 px-4 py-2 font-semibold transition ${
                    resultArtworkRole === role
                      ? "bg-[#f3cf9a] text-[#30242d]"
                      : "text-[#d8b997] hover:bg-[#3a2d32] hover:text-[#ffe3bd]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {!studyLocked && !showPlayer && (
          <div className={`absolute bottom-1 left-[170px] z-40 h-[76px] overflow-hidden border-y border-[#9f6f45]/22 bg-[#15131c]/48 py-1 backdrop-blur-sm transition-[right] ${showAppendix ? "right-[370px]" : "right-[240px]"}`} aria-label={copy.replayTitle}>
            {danmakuLanes.map((lane, laneIndex) => (
              <div key={laneIndex} className="mv-danmaku-lane h-1/2 overflow-hidden">
                <div
                  className="mv-danmaku-track flex h-full w-max min-w-max items-center"
                  style={{
                    animationDuration: `${38 + laneIndex * 8}s`,
                    animationPlayState: pausedDanmakuLane === laneIndex ? "paused" : "running",
                  }}
                >
                  {[0, 1].map((copyIndex) => (
                    <div
                      key={copyIndex}
                      className="flex min-w-[100vw] shrink-0 items-center gap-10 pr-10"
                      aria-hidden={copyIndex === 1}
                    >
                      {lane.map((message) => (
                        <p
                          key={`${copyIndex}-${message.id}`}
                          className={`mv-danmaku-item max-w-[min(54rem,74vw)] shrink-0 cursor-default truncate whitespace-nowrap rounded-full border px-4 py-1.5 text-xs shadow-[0_6px_18px_rgba(0,0,0,0.24)] transition-colors ${
                            message.role === "user"
                              ? "border-[#f2c675]/58 bg-[#694938]/88 text-[#fff0d4]"
                              : "border-white/16 bg-[#211d27]/88 text-[#f5ddbf]"
                          }`}
                          title={message.content}
                          onMouseEnter={() => setPausedDanmakuLane(laneIndex)}
                          onMouseLeave={() => setPausedDanmakuLane(null)}
                        >
                          <strong className="mr-2 font-semibold text-[#ffd28f]">{message.speaker}</strong>
                          {message.content}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          )}

          {audioUrl && (
              <>
                <audio
                  ref={audioRef}
                  src={audioUrl}
                  preload="auto"
                  onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
                  onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime || 0)}
                  onEnded={() => setIsAudioPlaying(false)}
                />
                <div className={`absolute bottom-1 left-4 z-50 flex h-[76px] items-center justify-center transition-[width] ${showPlayer ? "w-[620px]" : "w-[145px]"}`}>
                  {showPlayer ? (
                    <div className="flex w-full items-center gap-4 rounded-[22px] border border-[#a77b57]/46 bg-[#241f2a]/84 px-5 py-2.5 text-left shadow-[0_18px_50px_rgba(0,0,0,0.3)] backdrop-blur">
                    <button
                      type="button"
                      onClick={toggleAudio}
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#f6d3a0] text-[#2b2230] shadow-[0_0_24px_rgba(255,203,127,0.38)]"
                    >
                      {isAudioPlaying ? "Ⅱ" : "▶"}
                    </button>
                    <span className="min-w-[120px]">
                      <span className="block text-sm font-semibold text-[#ffe3bd]">{audioName}</span>
                      <span className="block text-xs text-[#c8aa8e]">
                        {audioBlocked ? copy.clickMusic : isAudioPlaying ? copy.playingWithImage : copy.clickAudio}
                      </span>
                    </span>
                    <span className="relative h-8 min-w-0 flex-1 overflow-hidden">
                      <span className="absolute left-0 right-0 top-1/2 h-px bg-[#8f6b52]/60" />
                      <span className="absolute left-0 top-1/2 h-px bg-[#ffd083]" style={{ width: `${progress}%` }} />
                      <span className="absolute inset-0 flex items-center gap-1">
                        {Array.from({ length: 52 }).map((_, index) => (
                          <span
                            key={index}
                            className="w-0.5 rounded-full bg-[#d99b4d]"
                            style={{ height: `${6 + Math.abs(Math.sin(index * 0.42)) * 24}px`, opacity: index / 52 <= progress / 100 ? 0.9 : 0.32 }}
                          />
                        ))}
                      </span>
                    </span>
                    <span className="text-xs tabular-nums text-[#d7b99b]">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPlayer(false)}
                      className="group relative rounded-full border border-[#a77b57]/42 px-3 py-1.5 text-xs text-[#d7b99b] hover:border-[#ffd083]/70"
                    >
                      {copy.collapse}
                      <span className="pointer-events-none absolute bottom-[38px] left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#a77b57]/44 bg-[#1f1923]/92 px-3 py-1.5 text-xs text-[#ffe3bd] opacity-0 shadow-[0_10px_24px_rgba(0,0,0,0.3)] transition group-hover:opacity-100">
                        {copy.collapsePlayerTip}
                      </span>
                    </button>
                  </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowPlayer(true)}
                      className="group relative flex items-center gap-2 rounded-full border border-[#ffd083]/42 bg-[#1f1923]/78 px-4 py-2 text-xs text-[#ffe3bd] shadow-[0_12px_34px_rgba(0,0,0,0.34)] backdrop-blur transition hover:border-[#ffd083]/80"
                    >
                      <span className="h-2 w-2 rounded-full bg-[#ffd083] shadow-[0_0_16px_rgba(255,208,131,0.8)]" />
                      {audioBlocked ? copy.expandControl : isAudioPlaying ? copy.musicPlaying : copy.expandControl}
                      <span className="pointer-events-none absolute bottom-[42px] left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#a77b57]/44 bg-[#1f1923]/92 px-3 py-1.5 text-xs text-[#ffe3bd] opacity-0 shadow-[0_10px_24px_rgba(0,0,0,0.3)] transition group-hover:opacity-100">
                        {copy.expandProgressTip}
                      </span>
                    </button>
                  )}
                </div>
              </>
            )}

          {showOverview && (
            <aside className="absolute bottom-4 left-4 top-4 z-[70] flex w-[330px] flex-col rounded-[18px] border border-[#a77b57]/50 bg-[#211c27]/94 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.52)] backdrop-blur-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-[#ffe3bd]">{copy.overviewTitle}</h2>
                  <p className="mt-2 text-xs leading-relaxed text-[#cdb297]">{copy.overviewText}</p>
                </div>
                <button type="button" onClick={() => setShowOverview(false)} className="text-xl text-[#d7b99b] hover:text-[#ffe3bd]" aria-label={copy.collapse}>×</button>
              </div>
              <div className="mt-4 space-y-2 border-t border-[#8f6b52]/34 pt-4 text-xs text-[#d7b99b]">
                <p className="flex justify-between gap-3"><span>{copy.generatedAt}</span><span>{generatedTime}</span></p>
                <p className="flex justify-between gap-3"><span>{copy.guideCount}</span><span>{characters.length}</span></p>
                <p className="flex justify-between gap-3"><span>{copy.modelStatus}</span><span>{debugInfo?.meta?.model || copy.generated}</span></p>
              </div>
              <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto border-t border-[#8f6b52]/34 pt-4 pr-1 text-xs text-[#d7b99b]">
                {!hasRationale && <p>{copy.noRationale}</p>}
                {userRationale.length > 0 && (
                  <div>
                    <p className="font-semibold text-[#ffe3bd]">{copy.userAnchor}</p>
                    {userRationale.map((mapping) => (
                      <p key={mapping.sourceId} className="mt-2 leading-relaxed text-[#e4c6a4]">
                        {language === "zh"
                          ? conversationUserMessages.find((message) => message.id === mapping.sourceId)?.content || mapping.visualTranslation
                          : mapping.visualTranslation}
                      </p>
                    ))}
                  </div>
                )}
                {briefRationale.length > 0 && (
                  <div className="border-t border-[#8f6b52]/28 pt-3">
                    <p className="font-semibold text-[#ffe3bd]">{copy.coCreationClues}</p>
                    {briefRationale.slice(0, 7).map((mapping) => (
                      <p key={mapping.field} className="mt-2 leading-relaxed">
                        <span className="text-[#efc68e]">{copy.fieldLabels[mapping.field]}</span> · {language === "zh"
                          ? briefFieldText(visualBrief, mapping.field, mapping.visualTranslation)
                          : mapping.visualTranslation}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          )}

          {!studyLocked && <details
            onToggle={(event) => {
              setShowAppendix(event.currentTarget.open);
              if (event.currentTarget.open) {
                recordExperimentEvent("research-appendix-opened", "/result", {
                  runId: debugInfo?.meta?.runId || null,
                });
              }
            }}
            className={`absolute bottom-1 right-4 z-[70] rounded-[18px] border border-[#a77b57]/44 bg-[#241f2a]/94 p-4 text-sm text-[#ffe3bd] shadow-[0_18px_50px_rgba(0,0,0,0.42)] backdrop-blur-xl transition-[width] ${showAppendix ? "w-[348px] 2xl:w-[404px]" : "w-[170px]"}`}
          >
            <summary className="cursor-pointer font-semibold">{copy.appendix}</summary>
            <div className="mt-4 max-h-[420px] overflow-auto pr-1">
              {debugInfo?.meta?.runId && !studyTrial && (
                <div className="rounded-[16px] border border-[#8f6b52]/34 bg-[#2d2732]/78 p-3">
                  <p className="mb-3 text-sm font-semibold">{copy.feedbackTitle}</p>
                  <div className="space-y-3">
                    {[
                      ["musicMatchScore", copy.musicMatch] as const,
                      ["commentMatchScore", copy.commentMatch] as const,
                      ["aestheticScore", copy.aesthetic] as const,
                    ].map(([key, label]) => (
                      <div key={key} className="flex items-center justify-between gap-3">
                        <span className="text-xs text-[#d7b99b]">{label}</span>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((score) => (
                            <button
                              key={score}
                              type="button"
                              onClick={() => updateScore(key, score)}
                              className={`h-7 w-7 rounded-full text-xs transition ${
                                feedback[key] >= score
                                  ? "bg-[#ffd083] text-[#2b2230]"
                                  : "bg-[#211b25] text-[#c8aa8e] hover:bg-[#3a2d32]"
                              }`}
                            >
                              {score}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    <div className="flex flex-wrap gap-2">
                      {FEEDBACK_REASONS[language].map((reason) => {
                        const selected = feedback.selectedReasons.includes(reason);
                        return (
                          <button
                            key={reason}
                            type="button"
                            onClick={() => toggleReason(reason)}
                            className={`rounded-full px-3 py-1.5 text-xs transition ${
                              selected
                                ? "bg-[#ffd083] text-[#2b2230]"
                                : "border border-[#8f6b52]/44 text-[#d7b99b] hover:border-[#ffd083]/60"
                            }`}
                          >
                            {reason}
                          </button>
                        );
                      })}
                    </div>
                    <textarea
                      value={feedback.freeText}
                      onChange={(event) => setFeedback((prev) => ({ ...prev, freeText: event.target.value }))}
                      placeholder={copy.feedbackPlaceholder}
                      className="h-16 w-full resize-none rounded-[12px] border border-[#8f6b52]/44 bg-[#211b25] p-3 text-xs text-[#ffe3bd] outline-none placeholder:text-[#9f8066] focus:border-[#ffd083]/70"
                    />
                    <button
                      type="button"
                      onClick={submitFeedback}
                      disabled={feedbackStatus === "saving" || feedbackStatus === "saved"}
                      className="w-full rounded-[14px] bg-[#4b3444] py-3 text-sm font-semibold text-[#ffe3bd] transition hover:bg-[#5a3b4d] disabled:opacity-55"
                    >
                      {feedbackStatus === "saving" ? copy.submitting : feedbackStatus === "saved" ? copy.saved : copy.submit}
                    </button>
                    {feedbackStatus === "error" && (
                      <p className="text-center text-xs text-[#ff9f9f]">{copy.feedbackError}</p>
                    )}
                  </div>
                </div>
              )}

              {debugInfo && (
                <details className="mt-3 rounded-[16px] border border-[#8f6b52]/34 bg-[#2d2732]/78 p-3">
                  <summary className="cursor-pointer text-sm font-semibold">{copy.debug}</summary>
                  <div className="mt-3 space-y-3 text-xs text-[#d7b99b]">
                    <pre className="max-h-32 overflow-auto rounded-[10px] bg-[#17131a] p-3 whitespace-pre-wrap">
                      {JSON.stringify(debugInfo.meta, null, 2)}
                    </pre>
                    <pre className="max-h-32 overflow-auto rounded-[10px] bg-[#17131a] p-3 whitespace-pre-wrap">
                      {JSON.stringify(debugInfo.musicAnalysis, null, 2)}
                    </pre>
                    <pre className="max-h-32 overflow-auto rounded-[10px] bg-[#17131a] p-3 whitespace-pre-wrap">
                      {JSON.stringify(commentsForDebug, null, 2)}
                    </pre>
                    <p className="max-h-32 overflow-auto rounded-[10px] bg-[#17131a] p-3 leading-relaxed whitespace-pre-wrap">
                      {debugInfo.prompt || copy.notRecorded}
                    </p>
                    {debugInfo.remoteImageUrl && (
                      <p className="overflow-auto rounded-[10px] bg-[#17131a] p-3 break-all">
                        {debugInfo.remoteImageUrl}
                      </p>
                    )}
                  </div>
                </details>
              )}
            </div>
          </details>}
          {!studyLocked && !showAppendix && (
            <button
              type="button"
              onClick={handleStartOver}
              aria-label={copy.startOver}
              title={copy.startOverTip}
              className="group absolute bottom-5 right-[194px] z-[60] flex h-11 w-11 items-center justify-center rounded-full border border-[#a77b57]/44 bg-[#241f2a]/88 text-[#ffe3bd] shadow-[0_14px_38px_rgba(0,0,0,0.28)] backdrop-blur transition hover:border-[#ffd083]/70 hover:bg-[#302735]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" />
              </svg>
              <span className="sr-only">{copy.startOver}</span>
              <span className="pointer-events-none absolute bottom-[46px] left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#a77b57]/44 bg-[#1f1923]/92 px-3 py-1.5 text-xs text-[#ffe3bd] opacity-0 shadow-[0_10px_24px_rgba(0,0,0,0.3)] transition group-hover:opacity-100">
                {copy.startOverTip}
              </span>
            </button>
          )}
        </section>
      </div>
    </main>
  );
}
