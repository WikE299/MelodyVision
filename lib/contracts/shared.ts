export const VERSION_2_SCHEMA_VERSION = "2.0.0" as const;

export type Version2SchemaVersion = typeof VERSION_2_SCHEMA_VERSION;
export type IsoDateTime = string;
export type ConfidenceScore = number;
export type NormalizedScore = number;

export interface TimeSeriesPoint {
  atSeconds: number;
  value: number;
}

export interface AnalyzedValue<T> {
  value: T;
  confidence: ConfidenceScore;
  evidenceIds: string[];
}

export interface ScoredLabel {
  label: string;
  score: NormalizedScore;
  evidenceIds: string[];
}

export type SourceReferenceKind =
  | "music-analysis"
  | "musician-message"
  | "guide-message"
  | "user-message"
  | "facilitator-subtitle"
  | "system";

export interface SourceReference {
  id: string;
  kind: SourceReferenceKind;
  sourceId: string;
  evidenceId?: string;
  fieldPath?: string;
  sectionId?: string;
  excerpt?: string;
}
