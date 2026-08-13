import type {
  ConversationState,
  MusicProfile,
  SessionComparisonChoice,
  StudyPeriodAssignment,
  StudySession,
  StudyAudioChoice,
  StudySessionComparison,
  StudyTrial,
  VisualBrief,
} from "./contracts";
import type { FacilitatorPlan } from "./agents/facilitator/types";

export interface StudySessionPayload {
  session: StudySession;
  assignments: [StudyPeriodAssignment, StudyPeriodAssignment];
  trials: StudyTrial[];
  periodResults: Array<{
    trial: StudyTrial;
    audioUrl: string;
    musicName: string;
    baselineJob: {
      trialId: string;
      status: "pending" | "running" | "completed" | "failed";
      attempts: number;
      runId: string | null;
      error: string;
      startedAt: string | null;
      updatedAt: string;
    } | null;
    musicProfile: MusicProfile | null;
    compatibilityAnalysis: Record<string, unknown> | null;
    conversationState: ConversationState | null;
    visualBrief: VisualBrief | null;
    facilitatorPlan: FacilitatorPlan | null;
    coCreated: {
      runId: string;
      imageUrl: string;
      prompt: string;
      imageModel: string;
      imageSize: string;
    } | null;
    baseline: {
      runId: string;
      imageUrl: string;
      prompt: string;
      imageModel: string;
      imageSize: string;
    } | null;
  }>;
  comparison: StudySessionComparison | null;
  recovered?: boolean;
}

async function parseStudyResponse(response: Response): Promise<StudySessionPayload> {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Study session request failed");
  return data as StudySessionPayload;
}

export async function createOrRecoverStudySession(input: {
  participantId: string;
  deviceSessionId: string;
  stimulusXId?: string;
  stimulusYId?: string;
}): Promise<StudySessionPayload> {
  const response = await fetch("/api/experiment/study-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "create", ...input }),
  });
  return parseStudyResponse(response);
}

export async function fetchStudySession(studySessionId: string): Promise<StudySessionPayload> {
  const response = await fetch(
    `/api/experiment/study-session?studySessionId=${encodeURIComponent(studySessionId)}`,
    { cache: "no-store" }
  );
  return parseStudyResponse(response);
}

export async function saveStudyAudioChoices(
  studySessionId: string,
  first: StudyAudioChoice,
  second: StudyAudioChoice
): Promise<StudySessionPayload> {
  const response = await fetch("/api/experiment/study-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "select_audio", studySessionId, first, second }),
  });
  return parseStudyResponse(response);
}

export async function saveStudySessionMusicians(
  studySessionId: string,
  selectedMusicianIds: string[]
): Promise<StudySessionPayload> {
  const response = await fetch("/api/experiment/study-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "select_musicians",
      studySessionId,
      selectedMusicianIds,
    }),
  });
  return parseStudyResponse(response);
}

export async function saveStudySessionComparison(input: {
  studySessionId: string;
  expressionSupportChoice: SessionComparisonChoice;
  immersionChoice: SessionComparisonChoice;
  creativeFreedomChoice: SessionComparisonChoice;
  overallChoice: SessionComparisonChoice;
  reason: string;
}): Promise<StudySessionPayload> {
  const response = await fetch("/api/experiment/study-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "compare", ...input }),
  });
  return parseStudyResponse(response);
}
