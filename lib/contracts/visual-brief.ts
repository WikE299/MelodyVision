import type {
  IsoDateTime,
  NormalizedScore,
  SourceReference,
  Version2SchemaVersion,
} from "./shared";

export type VisualBriefStatus = "collecting" | "ready" | "locked";
export type VisualBriefFieldStatus = "missing" | "suggested" | "confirmed" | "conflicted";
export type VisualBriefFieldKey =
  | "subject"
  | "space"
  | "composition"
  | "motion"
  | "materials"
  | "palette"
  | "lighting"
  | "atmosphere"
  | "personalMeaning"
  | "mustInclude"
  | "mustAvoid";

export interface VisualBriefField<T> {
  value: T | null;
  status: VisualBriefFieldStatus;
  sources: SourceReference[];
}

export interface VisualBriefFields {
  subject: VisualBriefField<string>;
  space: VisualBriefField<string>;
  composition: VisualBriefField<string>;
  motion: VisualBriefField<string[]>;
  materials: VisualBriefField<string[]>;
  palette: VisualBriefField<string[]>;
  lighting: VisualBriefField<string>;
  atmosphere: VisualBriefField<string[]>;
  personalMeaning: VisualBriefField<string>;
  mustInclude: VisualBriefField<string[]>;
  mustAvoid: VisualBriefField<string[]>;
}

export interface VisualBriefReadiness {
  score: NormalizedScore;
  ready: boolean;
  presentFields: VisualBriefFieldKey[];
  missingFields: VisualBriefFieldKey[];
  conflictedFields: VisualBriefFieldKey[];
  reasons: string[];
}

export interface VisualBrief {
  schemaVersion: Version2SchemaVersion;
  id: string;
  conversationId: string;
  musicProfileId: string;
  version: number;
  parentVersionId?: string;
  status: VisualBriefStatus;
  fields: VisualBriefFields;
  readiness: VisualBriefReadiness;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}
