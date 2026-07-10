import type { MusicProfile, ScoredLabel } from "../contracts";
import type { AudioFeatures } from "./web-analyzer";

export interface AudioSourceMetadata {
  title: string;
  artist?: string;
  tags: string[];
  source?: string;
  sourceUrl?: string;
}

export interface CompatibleMusicAnalysis {
  analysisEngine: "rich" | "meyda-degraded";
  degraded: boolean;
  musicProfileId?: string;
  tempo: string;
  mood: string;
  energy: string;
  brightness: string;
  dynamicRange: string;
  bpm: number | null;
  bpmConfidence?: number;
  duration: number;
  description: string;
  instruments: string[];
  sourceMetadata?: AudioSourceMetadata;
  tonalityCandidate?: {
    key: string | null;
    mode: string;
    confidence: number;
  };
  semanticCandidates: {
    moods: CandidateLabel[];
    textures: CandidateLabel[];
    motions: CandidateLabel[];
    spaces: CandidateLabel[];
  };
  segments: Array<{
    start: number;
    end: number;
    energy: string;
    brightness: string;
    motion: string;
    texture: string;
    dynamic: string;
    description?: string;
  }>;
  salientMoments: Array<{
    time?: number;
    type?: string;
    intensity?: number;
    description?: string;
  }>;
  curves: {
    energy: number[];
    brightness: number[];
    texture: number[];
  };
  visualMappingHints: string[];
  spectralCentroid?: number;
  spectralFlatness?: number;
  spectralRolloff?: number;
  analysisWarnings: string[];
}

interface CandidateLabel {
  label: string;
  score: number;
  evidenceIds: string[];
}

const LABELS: Record<string, string> = {
  serene: "宁静",
  melancholic: "忧郁",
  joyful: "欢快",
  tense: "紧张",
  solemn: "庄重",
  warm: "温暖",
  aggressive: "强烈",
  mysterious: "神秘",
  nostalgic: "怀旧",
  hopeful: "明朗",
  smooth: "平滑",
  rough: "粗粝",
  airy: "通透",
  dense: "稠密",
  sparse: "留白",
  granular: "颗粒",
  percussive: "打击感",
  sustained: "延展",
  still: "静止",
  flowing: "流动",
  swaying: "摇曳",
  driving: "推进",
  rising: "上扬",
  falling: "下沉",
  pulsing: "脉动",
  explosive: "爆发",
  intimate: "亲近",
  enclosed: "收拢",
  spacious: "开阔",
  distant: "遥远",
  reverberant: "回响",
  "open-air": "开放",
};

const KNOWN_INSTRUMENT_TAGS = new Set([
  "钢琴",
  "古琴",
  "二胡",
  "大提琴",
  "小号",
  "弦乐",
  "管弦",
  "打击",
  "人声",
  "piano",
  "cello",
  "trumpet",
  "strings",
  "orchestral",
  "percussion",
  "vocal",
]);

function candidateLabels(labels: ScoredLabel[]): CandidateLabel[] {
  return labels.slice(0, 3).map((item) => ({
    label: LABELS[item.label] ?? item.label,
    score: item.score,
    evidenceIds: item.evidenceIds,
  }));
}

function energyLabel(value: number): string {
  if (value < 0.3) return "舒缓";
  if (value < 0.58) return "中等";
  if (value < 0.8) return "强烈";
  return "极强";
}

function brightnessLabel(value: number): string {
  if (value < 0.2) return "暗沉";
  if (value < 0.45) return "柔和";
  if (value < 0.72) return "明亮";
  return "尖锐";
}

function dynamicRangeLabel(value: number): string {
  if (value < 0.3) return "平稳";
  if (value < 0.62) return "有起伏";
  return "大起大落";
}

function tempoLabel(bpm: number | null): string {
  if (bpm == null) return "拍速未确定";
  if (bpm < 70) return `慢速（约 ${Math.round(bpm)} BPM）`;
  if (bpm < 100) return `中慢速（约 ${Math.round(bpm)} BPM）`;
  if (bpm < 130) return `中速（约 ${Math.round(bpm)} BPM）`;
  if (bpm < 160) return `快速（约 ${Math.round(bpm)} BPM）`;
  return `急速候选（约 ${Math.round(bpm)} BPM，可能存在半拍解释）`;
}

function dynamicTrendLabel(value: string): string {
  return {
    stable: "平稳",
    rising: "渐强",
    falling: "渐弱",
    fluctuating: "起伏",
  }[value] ?? "平稳";
}

function fallbackMotion(dynamicTrend: string): string {
  return {
    stable: "静止",
    rising: "推进",
    falling: "下沉",
    fluctuating: "脉动",
  }[dynamicTrend] ?? "流动";
}

function knownInstruments(metadata?: AudioSourceMetadata): string[] {
  return metadata?.tags.filter((tag) => KNOWN_INSTRUMENT_TAGS.has(tag.toLowerCase())) ?? [];
}

export function profileToCompatibleAnalysis(
  profile: MusicProfile,
  metadata?: AudioSourceMetadata
): CompatibleMusicAnalysis {
  const bpm = profile.rhythm.bpm.value;
  const moodCandidates = candidateLabels(profile.semantics.moods);
  const textureCandidates = candidateLabels(profile.semantics.textures);
  const motionCandidates = candidateLabels(profile.semantics.motions);
  const spaceCandidates = candidateLabels(profile.semantics.spaces);
  const energy = energyLabel(profile.dynamics.averageEnergy.value);
  const brightness = brightnessLabel(profile.timbre.brightness.value);
  const dynamicRange = dynamicRangeLabel(profile.dynamics.dynamicComplexity.value);
  const tempo = tempoLabel(bpm);
  const warnings = profile.warnings.map((warning) => warning.code);
  if (profile.semantics.genres.length || profile.semantics.instruments.length) {
    warnings.push("clap_genre_instrument_suppressed");
  }

  return {
    analysisEngine: "rich",
    degraded: false,
    musicProfileId: profile.id,
    tempo,
    mood: moodCandidates.map((item) => item.label).join("、") || "未形成稳定候选",
    energy,
    brightness,
    dynamicRange,
    bpm,
    bpmConfidence: profile.rhythm.bpm.confidence,
    duration: profile.audio.durationSeconds,
    description: `分析记录到${tempo}，整体能量${energy}、音色${brightness}、动态${dynamicRange}，检测到 ${profile.sections.length} 个结构段落。`,
    instruments: knownInstruments(metadata),
    sourceMetadata: metadata,
    tonalityCandidate: {
      key: profile.tonality.key.value,
      mode: profile.tonality.mode.value,
      confidence: profile.tonality.key.confidence,
    },
    semanticCandidates: {
      moods: moodCandidates,
      textures: textureCandidates,
      motions: motionCandidates,
      spaces: spaceCandidates,
    },
    segments: profile.sections.map((section) => ({
      start: section.startSeconds,
      end: section.endSeconds,
      energy: energyLabel(section.energy),
      brightness: brightnessLabel(section.brightness),
      motion: candidateLabels(section.motions)[0]?.label ?? fallbackMotion(section.dynamicTrend),
      texture: candidateLabels(section.textures)[0]?.label ?? "未确定",
      dynamic: dynamicTrendLabel(section.dynamicTrend),
    })),
    salientMoments: [],
    curves: {
      energy: profile.dynamics.energyCurve.map((point) => point.value),
      brightness: profile.sections.map((section) => section.brightness),
      texture: profile.sections.map((section) => section.onsetDensity),
    },
    visualMappingHints: [],
    analysisWarnings: [...new Set(warnings)],
  };
}

export function meydaToDegradedAnalysis(
  features: AudioFeatures,
  metadata?: AudioSourceMetadata
): CompatibleMusicAnalysis {
  return {
    analysisEngine: "meyda-degraded",
    degraded: true,
    tempo: features.tempo,
    mood: features.mood,
    energy: features.energy,
    brightness: features.brightness,
    dynamicRange: features.dynamicRange,
    bpm: features.bpm,
    duration: features.durationSeconds,
    description: features.description,
    instruments: knownInstruments(metadata),
    sourceMetadata: metadata,
    semanticCandidates: { moods: [], textures: [], motions: [], spaces: [] },
    segments: features.segments,
    salientMoments: features.salientMoments,
    curves: features.curves,
    visualMappingHints: [],
    spectralCentroid: features.spectralCentroid,
    spectralFlatness: features.spectralFlatness,
    spectralRolloff: features.spectralRolloff,
    analysisWarnings: ["rich_analysis_unavailable", "meyda_semantics_are_rule_based"],
  };
}
