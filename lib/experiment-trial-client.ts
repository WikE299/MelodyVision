import type {
  InteractiveCondition,
  MusicProfile,
  StudyTrial,
} from "./contracts";

export async function createStudyTrial(input: {
  mode: "demo" | "study";
  sessionId: string;
  participantId?: string;
  musicProfileId: string;
  requestedCondition?: InteractiveCondition;
  studySessionId?: string;
  period?: 1 | 2;
  stimulusId?: string;
}): Promise<StudyTrial> {
  const response = await fetch("/api/experiment/trial", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Trial creation failed");
  return data.trial as StudyTrial;
}

export async function ensureStudyTrial(trial: StudyTrial): Promise<{
  trial: StudyTrial;
  recovered: boolean;
}> {
  const lookup = await fetch(`/api/experiment/trial?trialId=${encodeURIComponent(trial.id)}`);
  if (lookup.ok) {
    const data = await lookup.json();
    return { trial: data.trial as StudyTrial, recovered: false };
  }
  if (lookup.status !== 404) {
    const data = await lookup.json().catch(() => ({}));
    throw new Error(data.error || "Trial lookup failed");
  }

  const response = await fetch("/api/experiment/trial", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "recover",
      staleTrialId: trial.id,
      participantId: trial.participantId,
      sessionId: trial.sessionId,
      condition: trial.condition,
      assignmentMethod: trial.assignmentMethod,
      musicProfileId: trial.musicProfileId,
      studySessionId: trial.studySessionId || undefined,
      period: trial.period || undefined,
      stimulusId: trial.stimulusId || undefined,
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Trial recovery failed");
  return {
    trial: data.trial as StudyTrial,
    recovered: Boolean(data.recovered),
  };
}

export async function startDirectBaseline(input: {
  trial: StudyTrial;
  musicProfile: MusicProfile;
  musicAnalysis: Record<string, unknown>;
}) {
  const claimResponse = await fetch("/api/experiment/baseline", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trialId: input.trial.id }),
  });
  const claim = await claimResponse.json();
  if (!claimResponse.ok) throw new Error(claim.error || "Baseline claim failed");
  if (!claim.acquired) return claim;

  const generationResponse = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      trialId: input.trial.id,
      baselineLease: claim.job?.startedAt,
      generationRole: "direct_baseline",
      condition: input.trial.condition,
      sessionId: input.trial.sessionId,
      musicProfile: input.musicProfile,
      musicAnalysis: input.musicAnalysis,
      presets: {},
    }),
  });
  const generation = await generationResponse.json();
  if (!generationResponse.ok) {
    await fetch("/api/experiment/baseline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trialId: input.trial.id,
        action: "fail",
        error: generation.detail || generation.error || "Baseline generation failed",
      }),
    }).catch(() => undefined);
    throw new Error(generation.detail || generation.error || "Baseline generation failed");
  }
  return generation;
}
