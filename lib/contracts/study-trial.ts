import type { IsoDateTime } from "./shared";

export type InteractiveCondition = "multi_agent" | "single_agent";
export type GenerationRole = "co_created" | "direct_baseline";
export type AssignmentMethod = "demo_choice" | "balanced_random" | "crossover_block";
export type ComparisonOrder = "co_created_left" | "baseline_left";
export type StudyPeriod = 1 | 2;
export type StudySequence =
  | "single_x_then_multi_y"
  | "multi_x_then_single_y"
  | "single_y_then_multi_x"
  | "multi_y_then_single_x";
export type StudySessionStatus =
  | "created"
  | "period_1"
  | "between_periods"
  | "period_2"
  | "comparing"
  | "baseline_review"
  | "completed";
export type SessionComparisonChoice = "period_1" | "period_2" | "tie";
export type StudyTrialStatus =
  | "created"
  | "interacting"
  | "generating"
  | "evaluating"
  | "completed";
export type BaselineJobStatus = "pending" | "running" | "completed" | "failed";
export const CURRENT_STUDY_PROTOCOL_VERSION = "v2-15-within-subject-crossover";

export interface StudyPeriodAssignment {
  period: StudyPeriod;
  condition: InteractiveCondition;
  stimulusId: string;
  trialId: string | null;
}

export interface StudySession {
  id: string;
  participantId: string;
  deviceSessionId: string;
  protocolVersion: string;
  sequence: StudySequence;
  status: StudySessionStatus;
  currentPeriod: StudyPeriod;
  stimulusXId: string;
  stimulusYId: string;
  selectedMusicianIds: string[];
  firstTrialId: string | null;
  secondTrialId: string | null;
  assignmentBlockId: string;
  assignmentPosition: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  completedAt: IsoDateTime | null;
}

export interface StudySessionComparison {
  studySessionId: string;
  expressionSupportChoice: SessionComparisonChoice;
  immersionChoice: SessionComparisonChoice;
  creativeFreedomChoice: SessionComparisonChoice;
  overallChoice: SessionComparisonChoice;
  reason: string;
  createdAt: IsoDateTime;
}

export interface StudyTrial {
  id: string;
  participantId: string;
  sessionId: string;
  studySessionId: string | null;
  period: StudyPeriod | null;
  stimulusId: string;
  condition: InteractiveCondition;
  assignmentMethod: AssignmentMethod;
  musicProfileId: string;
  coCreatedRunId: string | null;
  baselineRunId: string | null;
  protocolVersion: string;
  /** @deprecated Preserved only for trials created by the former blind-comparison protocol. */
  comparisonOrder: ComparisonOrder | null;
  status: StudyTrialStatus;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export function isInteractiveCondition(value: unknown): value is InteractiveCondition {
  return value === "multi_agent" || value === "single_agent";
}

export function isGenerationRole(value: unknown): value is GenerationRole {
  return value === "co_created" || value === "direct_baseline";
}

export function isStudySequence(value: unknown): value is StudySequence {
  return (
    value === "single_x_then_multi_y" ||
    value === "multi_x_then_single_y" ||
    value === "single_y_then_multi_x" ||
    value === "multi_y_then_single_x"
  );
}

export function isSessionComparisonChoice(value: unknown): value is SessionComparisonChoice {
  return value === "period_1" || value === "period_2" || value === "tie";
}
