export type QuestionnaireLanguage = "zh" | "en";

export type QuestionnaireInstrument =
  | "background"
  | "csi"
  | "agency_ownership"
  | "sus"
  | "raw_tlx"
  | "manipulation_check"
  | "csi_weighting"
  | "image_alignment"
  | "session_preference";

export type QuestionnaireAnswer = number | string | boolean | null;
export type QuestionnaireAnswers = Record<string, QuestionnaireAnswer>;

export interface QuestionnaireOption {
  value: string;
  label: string;
}

interface BaseQuestion {
  id: string;
  prompt: string;
  required: boolean;
  help?: string;
}

export interface ScaleQuestion extends BaseQuestion {
  kind: "scale";
  min: number;
  max: number;
  step: number;
  minLabel: string;
  maxLabel: string;
  allowNotApplicable?: boolean;
  presentation?: "buttons" | "slider";
}

export interface ChoiceQuestion extends BaseQuestion {
  kind: "choice";
  options: QuestionnaireOption[];
}

export interface TextQuestion extends BaseQuestion {
  kind: "text";
  multiline?: boolean;
  placeholder?: string;
  maxLength?: number;
}

export interface NumberQuestion extends BaseQuestion {
  kind: "number";
  min: number;
  max: number;
  step: number;
  suffix?: string;
}

export interface PairQuestion extends BaseQuestion {
  kind: "pair";
  left: QuestionnaireOption;
  right: QuestionnaireOption;
}

export type QuestionnaireQuestion =
  | ScaleQuestion
  | ChoiceQuestion
  | TextQuestion
  | NumberQuestion
  | PairQuestion;

export interface QuestionnaireDefinition {
  instrument: QuestionnaireInstrument;
  version: string;
  title: string;
  shortTitle: string;
  intro: string;
  pageSize: number;
  questions: QuestionnaireQuestion[];
}

export interface QuestionnaireValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export interface QuestionnaireScoreResult {
  instrument: QuestionnaireInstrument;
  version: string;
  complete: boolean;
  total: number | null;
  metrics: Record<string, number>;
}

export interface QuestionnaireMedia {
  src: string;
  alt: string;
  label: string;
  detail?: string;
}
