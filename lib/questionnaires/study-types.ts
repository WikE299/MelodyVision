import type {
  GenerationRole,
  InteractiveCondition,
  StudyPeriod,
} from "../contracts/study-trial.ts";
import type {
  QuestionnaireAnswers,
  QuestionnaireInstrument,
} from "./types.ts";

export type QuestionnaireScope =
  | "pre_study"
  | "post_period"
  | "artwork"
  | "post_session";

export type QuestionnaireResponseStatus = "draft" | "completed";

export interface QuestionnaireResponse {
  id: string;
  responseKey: string;
  participantId: string;
  studySessionId: string;
  trialId: string | null;
  runId: string | null;
  period: StudyPeriod | null;
  condition: InteractiveCondition | null;
  generationRole: GenerationRole | null;
  instrument: QuestionnaireInstrument;
  questionnaireVersion: string;
  scope: QuestionnaireScope;
  status: QuestionnaireResponseStatus;
  answers: QuestionnaireAnswers;
  totalScore: number | null;
  metrics: Record<string, number>;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface StudyQuestionnaireStep {
  key: string;
  instrument: QuestionnaireInstrument;
  scope: QuestionnaireScope;
  trialId: string | null;
  runId: string | null;
  period: StudyPeriod | null;
  condition: InteractiveCondition | null;
  generationRole: GenerationRole | null;
  sequenceIndex: number;
  sequenceTotal: number;
  imageUrl?: string;
  imageLabel?: string;
}

export type StudyQuestionnaireNextAction =
  | "questionnaire"
  | "select_music"
  | "experience"
  | "result"
  | "wait_baseline"
  | "complete";

export interface StudyQuestionnaireProgress {
  nextAction: StudyQuestionnaireNextAction;
  nextStep: StudyQuestionnaireStep | null;
  resultTrialId: string | null;
  responses: QuestionnaireResponse[];
  completedKeys: string[];
  baselineEligibleTrialIds: string[];
}
