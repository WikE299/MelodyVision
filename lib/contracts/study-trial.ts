import type { IsoDateTime } from "./shared";

export type InteractiveCondition = "multi_agent" | "single_agent";
export type GenerationRole = "co_created" | "direct_baseline";
export type AssignmentMethod = "demo_choice" | "balanced_random";
export type ComparisonOrder = "co_created_left" | "baseline_left";
export type StudyTrialStatus =
  | "created"
  | "interacting"
  | "generating"
  | "evaluating"
  | "completed";
export type BaselineJobStatus = "pending" | "running" | "completed" | "failed";

export interface StudyTrial {
  id: string;
  participantId: string;
  sessionId: string;
  condition: InteractiveCondition;
  assignmentMethod: AssignmentMethod;
  musicProfileId: string;
  coCreatedRunId: string | null;
  baselineRunId: string | null;
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
