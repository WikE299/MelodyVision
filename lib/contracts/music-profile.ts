import type {
  AnalyzedValue,
  ConfidenceScore,
  IsoDateTime,
  NormalizedScore,
  ScoredLabel,
  TimeSeriesPoint,
  Version2SchemaVersion,
} from "./shared";

export type AudioSourceKind = "upload" | "preset" | "search";
export type TonalMode = "major" | "minor" | "modal" | "atonal" | "unknown";
export type DensityLevel = "sparse" | "medium" | "dense";
export type MusicSectionPhase =
  | "opening"
  | "development"
  | "turning-point"
  | "climax"
  | "release"
  | "ending"
  | "unknown";
export type DynamicTrend = "stable" | "rising" | "falling" | "fluctuating";

export interface AudioReference {
  name: string;
  sourceKind: AudioSourceKind;
  durationSeconds: number;
  byteSize?: number;
  mimeType?: string;
  contentHash?: string;
  catalogItemId?: string;
}

export interface AnalyzerDescriptor {
  name: string;
  version: string;
  model?: string;
  role: "signal" | "semantic" | "derived";
}

export interface AnalysisEvidence {
  id: string;
  analyzer: string;
  method: string;
  description: string;
  sectionId?: string;
  startSeconds?: number;
  endSeconds?: number;
}

export interface AnalysisWarning {
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
  analyzer?: string;
}

export interface RhythmProfile {
  bpm: AnalyzedValue<number | null>;
  beatStrength: AnalyzedValue<NormalizedScore>;
  onsetDensity: AnalyzedValue<DensityLevel>;
  beatsSeconds: number[];
  tempoCurve: TimeSeriesPoint[];
  onsetDensityCurve: TimeSeriesPoint[];
}

export interface TonalityProfile {
  key: AnalyzedValue<string | null>;
  mode: AnalyzedValue<TonalMode>;
  chromaProfile: number[];
  harmonicChangeCurve: TimeSeriesPoint[];
  harmonicStability: AnalyzedValue<NormalizedScore>;
}

export interface DynamicsProfile {
  averageEnergy: AnalyzedValue<NormalizedScore>;
  dynamicComplexity: AnalyzedValue<NormalizedScore>;
  energyCurve: TimeSeriesPoint[];
  loudnessCurve: TimeSeriesPoint[];
}

export interface TimbreProfile {
  brightness: AnalyzedValue<NormalizedScore>;
  warmth: AnalyzedValue<NormalizedScore>;
  roughness: AnalyzedValue<NormalizedScore>;
  noisiness: AnalyzedValue<NormalizedScore>;
}

export interface MusicSection {
  id: string;
  order: number;
  startSeconds: number;
  endSeconds: number;
  phase: MusicSectionPhase;
  boundaryConfidence: ConfidenceScore;
  energy: NormalizedScore;
  brightness: NormalizedScore;
  onsetDensity: NormalizedScore;
  dynamicTrend: DynamicTrend;
  moods: ScoredLabel[];
  instruments: ScoredLabel[];
  textures: ScoredLabel[];
  motions: ScoredLabel[];
}

export interface SemanticProfile {
  moods: ScoredLabel[];
  genres: ScoredLabel[];
  instruments: ScoredLabel[];
  textures: ScoredLabel[];
  motions: ScoredLabel[];
  spaces: ScoredLabel[];
}

export interface MusicProfile {
  schemaVersion: Version2SchemaVersion;
  id: string;
  sessionId: string;
  audio: AudioReference;
  analyzers: AnalyzerDescriptor[];
  rhythm: RhythmProfile;
  tonality: TonalityProfile;
  dynamics: DynamicsProfile;
  timbre: TimbreProfile;
  sections: MusicSection[];
  semantics: SemanticProfile;
  evidence: AnalysisEvidence[];
  warnings: AnalysisWarning[];
  createdAt: IsoDateTime;
}
