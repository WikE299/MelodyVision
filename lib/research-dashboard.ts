import { CURRENT_STUDY_PROTOCOL_VERSION } from "./contracts/study-trial.ts";

type RawRecord = Record<string, unknown>;

export interface RawExperimentExport {
  schemaVersion: number;
  exportedAt: string;
  sessions: RawRecord[];
  audioAnalyses: RawRecord[];
  conversationSnapshots: RawRecord[];
  visualBriefVersions: RawRecord[];
  interactionEvents: RawRecord[];
  runs: RawRecord[];
  feedback: RawRecord[];
  trials: RawRecord[];
  baselineJobs: RawRecord[];
  artworkEvaluations: RawRecord[];
  pairwiseComparisons: RawRecord[];
  labeledComparisons: RawRecord[];
  manipulationChecks: RawRecord[];
}

export type ResearchCondition = "multi_agent" | "single_agent" | "unknown";
export type ResearchChoice = "co_created" | "direct_baseline" | "tie";

export interface ResearchScoreMetric {
  key: string;
  label: string;
  count: number;
  mean: number | null;
  median: number | null;
  distribution: [number, number, number, number, number];
}

export interface ResearchChoiceMetric {
  key: string;
  label: string;
  coCreated: number;
  baseline: number;
  tie: number;
  count: number;
}

export interface ResearchConditionSummary {
  condition: ResearchCondition;
  trials: number;
  completed: number;
  questionnaireComplete: number;
  generationComplete: number;
}

export interface ResearchSummary {
  totalTrials: number;
  completedTrials: number;
  questionnaireCompleteTrials: number;
  generationCompleteTrials: number;
  baselineCompleteTrials: number;
  completionRate: number;
  questionnaireRate: number;
  generationRate: number;
  baselineRate: number;
  conditions: ResearchConditionSummary[];
  artworkScores: ResearchScoreMetric[];
  manipulationScores: ResearchScoreMetric[];
  choices: ResearchChoiceMetric[];
}

export interface ResearchDataIssue {
  id: string;
  trialId: string;
  severity: "warning" | "error";
  code: string;
  label: string;
}

export interface ResearchRun {
  id: string;
  role: string;
  createdAt: string;
  imageUrl: string;
  remoteImageUrl: string;
  prompt: string;
  negativePrompt: string;
  imageModel: string;
  imageSize: string;
  totalMs: number | null;
  timings: unknown;
  modelConfig: unknown;
  promptDirector: unknown;
  runLog: unknown;
  raw: RawRecord;
}

export interface ResearchTrialRecord {
  id: string;
  participantId: string;
  sessionId: string;
  condition: ResearchCondition;
  assignmentMethod: string;
  protocolVersion: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  musicProfileId: string;
  musicTitle: string;
  audioSourceKind: string;
  audioFileName: string;
  analysisMode: string;
  musicProfile: unknown;
  compatibilityAnalysis: unknown;
  conversationState: unknown;
  conversationMessages: RawRecord[];
  visualBrief: unknown;
  visualBriefVersions: RawRecord[];
  interactionEvents: RawRecord[];
  coCreatedRun: ResearchRun | null;
  baselineRun: ResearchRun | null;
  baselineJob: RawRecord | null;
  artworkEvaluation: RawRecord | null;
  comparison: {
    kind: "labeled" | "pairwise";
    musicMatchChoice: ResearchChoice | null;
    imaginationMatchChoice: ResearchChoice | null;
    overallChoice: ResearchChoice | null;
    reason: string;
  } | null;
  manipulationCheck: RawRecord | null;
  questionnaireComplete: boolean;
  generationComplete: boolean;
  baselineComplete: boolean;
  issues: ResearchDataIssue[];
}

export interface ResearchDashboardDataset {
  source: {
    kind: "database" | "snapshot";
    capturedAt: string;
    schemaVersion: number;
  };
  currentProtocolVersion: string;
  protocols: string[];
  summary: ResearchSummary;
  trials: ResearchTrialRecord[];
  dataQualityIssues: ResearchDataIssue[];
}

const ARTWORK_SCORE_FIELDS = [
  ["music_match_score", "音乐匹配"],
  ["imagination_match_score", "想象匹配"],
  ["agency_score", "主体感"],
  ["ownership_score", "所有权"],
  ["immersion_score", "沉浸感"],
  ["satisfaction_score", "满意度"],
] as const;

const MANIPULATION_SCORE_FIELDS = [
  ["perspective_multiplicity_score", "多视角感"],
  ["articulation_support_score", "表达支持"],
  ["dialogue_experience_score", "对话体验"],
] as const;

function isRecord(value: unknown): value is RawRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function rows(value: unknown): RawRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function nested(record: RawRecord | null | undefined, key: string): RawRecord | null {
  const value = record?.[key];
  return isRecord(value) ? value : null;
}

function list(record: RawRecord | null | undefined, key: string): RawRecord[] {
  return rows(record?.[key]);
}

function choice(value: unknown): ResearchChoice | null {
  return value === "co_created" || value === "direct_baseline" || value === "tie"
    ? value
    : null;
}

function condition(value: unknown): ResearchCondition {
  return value === "multi_agent" || value === "single_agent" ? value : "unknown";
}

function latest(records: RawRecord[]): RawRecord | null {
  return records.reduce<RawRecord | null>((selected, candidate) => {
    if (!selected) return candidate;
    const candidateTime = Date.parse(text(candidate.created_at));
    const selectedTime = Date.parse(text(selected.created_at));
    return candidateTime > selectedTime ? candidate : selected;
  }, null);
}

function findForTrial(
  records: RawRecord[],
  trialId: string,
  sessionId: string,
  startedAt?: number,
  endedAt?: number | null
): RawRecord[] {
  return records.filter((record) => {
    const recordTrialId = text(record.trial_id);
    if (recordTrialId === trialId) return true;
    if (recordTrialId || text(record.session_id) !== sessionId) return false;
    if (startedAt === undefined) return true;
    const recordTime = Date.parse(text(record.created_at));
    return Number.isFinite(recordTime)
      && recordTime >= startedAt
      && (endedAt === null || endedAt === undefined || recordTime < endedAt);
  });
}

function runRecord(record: RawRecord | null): ResearchRun | null {
  if (!record) return null;
  return {
    id: text(record.id),
    role: text(record.generation_role) || "legacy",
    createdAt: text(record.created_at),
    imageUrl: text(record.image_url),
    remoteImageUrl: text(record.remote_image_url),
    prompt: text(record.final_image_prompt),
    negativePrompt: text(record.negative_prompt),
    imageModel: text(record.image_model),
    imageSize: text(record.image_size),
    totalMs: numberOrNull(nested(record, "timings")?.totalMs),
    timings: record.timings ?? {},
    modelConfig: record.model_config ?? {},
    promptDirector: record.prompt_director ?? {},
    runLog: record.run_log ?? {},
    raw: record,
  };
}

function resolveRun(
  records: RawRecord[],
  id: string,
  trialId: string,
  role: "co_created" | "direct_baseline"
): ResearchRun | null {
  const record = records.find((item) => text(item.id) === id)
    || latest(records.filter((item) =>
      text(item.trial_id) === trialId && text(item.generation_role) === role
    ));
  return runRecord(record);
}

function scoreMetric(
  trials: ResearchTrialRecord[],
  field: string,
  label: string,
  source: "artworkEvaluation" | "manipulationCheck"
): ResearchScoreMetric {
  const values = trials
    .map((trial) => numberOrNull(trial[source]?.[field]))
    .filter((value): value is number => value !== null && value >= 1 && value <= 5);
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length === 0
    ? null
    : sorted.length % 2 === 0
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle];
  return {
    key: field,
    label,
    count: values.length,
    mean: values.length
      ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100
      : null,
    median,
    distribution: [1, 2, 3, 4, 5].map(
      (score) => values.filter((value) => value === score).length
    ) as [number, number, number, number, number],
  };
}

function choiceMetric(
  trials: ResearchTrialRecord[],
  key: "musicMatchChoice" | "imaginationMatchChoice" | "overallChoice",
  label: string
): ResearchChoiceMetric {
  const values = trials
    .map((trial) => trial.comparison?.[key] || null)
    .filter((value): value is ResearchChoice => value !== null);
  return {
    key,
    label,
    coCreated: values.filter((value) => value === "co_created").length,
    baseline: values.filter((value) => value === "direct_baseline").length,
    tie: values.filter((value) => value === "tie").length,
    count: values.length,
  };
}

function rate(value: number, total: number): number {
  return total ? Math.round((value / total) * 1000) / 10 : 0;
}

export function summarizeResearchTrials(trials: ResearchTrialRecord[]): ResearchSummary {
  const completedTrials = trials.filter((trial) => trial.status === "completed").length;
  const questionnaireCompleteTrials = trials.filter((trial) => trial.questionnaireComplete).length;
  const generationCompleteTrials = trials.filter((trial) => trial.generationComplete).length;
  const baselineCompleteTrials = trials.filter((trial) => trial.baselineComplete).length;
  const conditions: ResearchCondition[] = ["multi_agent", "single_agent", "unknown"];
  return {
    totalTrials: trials.length,
    completedTrials,
    questionnaireCompleteTrials,
    generationCompleteTrials,
    baselineCompleteTrials,
    completionRate: rate(completedTrials, trials.length),
    questionnaireRate: rate(questionnaireCompleteTrials, trials.length),
    generationRate: rate(generationCompleteTrials, trials.length),
    baselineRate: rate(baselineCompleteTrials, trials.length),
    conditions: conditions
      .map((item) => {
        const matching = trials.filter((trial) => trial.condition === item);
        return {
          condition: item,
          trials: matching.length,
          completed: matching.filter((trial) => trial.status === "completed").length,
          questionnaireComplete: matching.filter((trial) => trial.questionnaireComplete).length,
          generationComplete: matching.filter((trial) => trial.generationComplete).length,
        };
      })
      .filter((item) => item.trials > 0),
    artworkScores: ARTWORK_SCORE_FIELDS.map(([field, label]) =>
      scoreMetric(trials, field, label, "artworkEvaluation")
    ),
    manipulationScores: MANIPULATION_SCORE_FIELDS.map(([field, label]) =>
      scoreMetric(trials, field, label, "manipulationCheck")
    ),
    choices: [
      choiceMetric(trials, "musicMatchChoice", "音乐匹配"),
      choiceMetric(trials, "imaginationMatchChoice", "想象／审美匹配"),
      choiceMetric(trials, "overallChoice", "总体选择"),
    ],
  };
}

function issue(
  trialId: string,
  code: string,
  label: string,
  severity: ResearchDataIssue["severity"] = "warning"
): ResearchDataIssue {
  return { id: `${trialId}:${code}`, trialId, code, label, severity };
}

function buildTrial(
  trial: RawRecord,
  data: RawExperimentExport
): ResearchTrialRecord {
  const trialId = text(trial.id);
  const sessionId = text(trial.session_id);
  const protocolVersion = text(trial.protocol_version) || "legacy";
  const startedAt = Date.parse(text(trial.created_at));
  const nextTrialAt = data.trials
    .filter((candidate) =>
      text(candidate.session_id) === sessionId
      && Date.parse(text(candidate.created_at)) > startedAt
    )
    .reduce<number | null>((selected, candidate) => {
      const candidateTime = Date.parse(text(candidate.created_at));
      return selected === null || candidateTime < selected ? candidateTime : selected;
    }, null);
  const scopedRecords = (records: RawRecord[]) =>
    findForTrial(records, trialId, sessionId, startedAt, nextTrialAt);
  const audio = latest(scopedRecords(data.audioAnalyses));
  const audioProfile = nested(audio, "music_profile");
  const audioMeta = nested(audioProfile, "audio");
  const trialRuns = scopedRecords(data.runs);
  const coCreatedRun = resolveRun(
    data.runs,
    text(trial.co_created_run_id),
    trialId,
    "co_created"
  );
  const baselineRun = resolveRun(
    data.runs,
    text(trial.baseline_run_id),
    trialId,
    "direct_baseline"
  );
  const baselineJob = data.baselineJobs.find((item) => text(item.trial_id) === trialId) || null;
  const artworkEvaluation = data.artworkEvaluations.find(
    (item) => text(item.trial_id) === trialId
  ) || null;
  const labeled = data.labeledComparisons.find((item) => text(item.trial_id) === trialId) || null;
  const pairwise = data.pairwiseComparisons.find((item) => text(item.trial_id) === trialId) || null;
  const manipulationCheck = data.manipulationChecks.find(
    (item) => text(item.trial_id) === trialId
  ) || null;
  const comparison = labeled
    ? {
        kind: "labeled" as const,
        musicMatchChoice: choice(labeled.music_match_choice),
        imaginationMatchChoice: choice(labeled.imagination_match_choice),
        overallChoice: choice(labeled.overall_choice),
        reason: text(labeled.reason),
      }
    : pairwise
      ? {
          kind: "pairwise" as const,
          musicMatchChoice: choice(pairwise.music_match_choice),
          imaginationMatchChoice: choice(pairwise.aesthetic_choice),
          overallChoice: choice(pairwise.overall_choice),
          reason: text(pairwise.reason),
        }
      : null;
  const snapshots = scopedRecords(data.conversationSnapshots);
  const conversationSnapshot = latest(snapshots);
  const conversationState = conversationSnapshot?.state ?? coCreatedRun?.raw.conversation_state ?? null;
  const visualBriefVersions = scopedRecords(data.visualBriefVersions)
    .sort((a, b) => Number(a.version || 0) - Number(b.version || 0));
  const visualBrief = visualBriefVersions.at(-1)?.brief ?? coCreatedRun?.raw.visual_brief ?? null;
  const interactionEvents = scopedRecords(data.interactionEvents)
    .sort((a, b) => Date.parse(text(a.created_at)) - Date.parse(text(b.created_at)));
  const isCurrentProtocol = protocolVersion === CURRENT_STUDY_PROTOCOL_VERSION;
  const questionnaireComplete = isCurrentProtocol
    ? Boolean(artworkEvaluation && labeled && manipulationCheck)
    : Boolean(artworkEvaluation && (pairwise || labeled));
  const generationComplete = Boolean(
    coCreatedRun?.imageUrl && baselineRun?.imageUrl
  );
  const baselineComplete = text(baselineJob?.status) === "completed"
    && Boolean(baselineRun?.imageUrl);
  const issues: ResearchDataIssue[] = [];
  if (!audio) issues.push(issue(trialId, "missing_audio_analysis", "缺少音频分析", "error"));
  if (!coCreatedRun && ["generating", "evaluating", "completed"].includes(text(trial.status))) {
    issues.push(issue(trialId, "missing_co_created_run", "缺少共创作品记录", "error"));
  }
  if (!baselineRun && ["evaluating", "completed"].includes(text(trial.status))) {
    issues.push(issue(trialId, "missing_baseline_run", "缺少 Baseline 作品记录", "error"));
  }
  if (text(baselineJob?.status) === "failed") {
    issues.push(issue(
      trialId,
      "baseline_failed",
      `Baseline 生成失败${text(baselineJob?.error) ? `：${text(baselineJob?.error)}` : ""}`,
      "error"
    ));
  }
  if (text(trial.status) === "completed" && !questionnaireComplete) {
    issues.push(issue(trialId, "incomplete_questionnaire", "Trial 已完成但问卷不完整"));
  }
  if (!isCurrentProtocol) {
    issues.push(issue(trialId, "legacy_protocol", `历史协议：${protocolVersion}`));
  }
  if (trialRuns.length > 0 && !text(trial.co_created_run_id) && coCreatedRun) {
    issues.push(issue(trialId, "unlinked_co_created_run", "共创作品未写入 Trial 外键"));
  }

  const runAnalysis = nested(coCreatedRun?.raw, "music_analysis");
  const sourceMetadata = nested(runAnalysis, "sourceMetadata");
  const musicTitle = text(sourceMetadata?.title)
    || text(audioMeta?.name)
    || text(audio?.file_name)
    || "未命名音乐";

  return {
    id: trialId,
    participantId: text(trial.participant_id),
    sessionId,
    condition: condition(trial.condition),
    assignmentMethod: text(trial.assignment_method),
    protocolVersion,
    status: text(trial.status),
    createdAt: text(trial.created_at),
    updatedAt: text(trial.updated_at),
    musicProfileId: text(trial.music_profile_id),
    musicTitle,
    audioSourceKind: text(audio?.source_kind) || text(audioMeta?.sourceKind),
    audioFileName: text(audio?.file_name) || text(audioMeta?.name),
    analysisMode: text(audio?.mode),
    musicProfile: audio?.music_profile ?? coCreatedRun?.raw.music_profile ?? null,
    compatibilityAnalysis: audio?.compatibility_analysis ?? null,
    conversationState,
    conversationMessages: list(
      isRecord(conversationState) ? conversationState : null,
      "messages"
    ),
    visualBrief,
    visualBriefVersions,
    interactionEvents,
    coCreatedRun,
    baselineRun,
    baselineJob,
    artworkEvaluation,
    comparison,
    manipulationCheck,
    questionnaireComplete,
    generationComplete,
    baselineComplete,
    issues,
  };
}

export function parseExperimentExport(value: unknown): RawExperimentExport {
  if (!isRecord(value)) throw new Error("文件不是有效的实验 JSON");
  const schemaVersion = numberOrNull(value.schemaVersion);
  if (schemaVersion === null || schemaVersion < 4) {
    throw new Error("仅支持 schemaVersion 4 或更高版本的实验导出");
  }
  if (!Array.isArray(value.trials)) throw new Error("实验导出缺少 trials 数组");
  return {
    schemaVersion,
    exportedAt: text(value.exportedAt) || new Date().toISOString(),
    sessions: rows(value.sessions),
    audioAnalyses: rows(value.audioAnalyses),
    conversationSnapshots: rows(value.conversationSnapshots),
    visualBriefVersions: rows(value.visualBriefVersions),
    interactionEvents: rows(value.interactionEvents),
    runs: rows(value.runs),
    feedback: rows(value.feedback),
    trials: rows(value.trials),
    baselineJobs: rows(value.baselineJobs),
    artworkEvaluations: rows(value.artworkEvaluations),
    pairwiseComparisons: rows(value.pairwiseComparisons),
    labeledComparisons: rows(value.labeledComparisons),
    manipulationChecks: rows(value.manipulationChecks),
  };
}

export function buildResearchDashboardDataset(
  value: unknown,
  sourceKind: "database" | "snapshot" = "snapshot"
): ResearchDashboardDataset {
  const data = parseExperimentExport(value);
  const trials = data.trials
    .map((trial) => buildTrial(trial, data))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const dataQualityIssues = trials.flatMap((trial) => trial.issues);
  const protocols = [...new Set(trials.map((trial) => trial.protocolVersion))].sort();
  const defaultTrials = trials.filter(
    (trial) => trial.protocolVersion === CURRENT_STUDY_PROTOCOL_VERSION
  );
  return {
    source: {
      kind: sourceKind,
      capturedAt: data.exportedAt,
      schemaVersion: data.schemaVersion,
    },
    currentProtocolVersion: CURRENT_STUDY_PROTOCOL_VERSION,
    protocols,
    summary: summarizeResearchTrials(defaultTrials),
    trials,
    dataQualityIssues,
  };
}

function csvValue(value: unknown): string {
  let stringValue = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(stringValue)) stringValue = `'${stringValue}`;
  return `"${stringValue.replace(/"/g, '""')}"`;
}

export function exportResearchTrialsCsv(trials: ResearchTrialRecord[]): string {
  const headers = [
    "trial_id",
    "participant_id",
    "session_id",
    "condition",
    "assignment_method",
    "protocol_version",
    "status",
    "created_at",
    "music_title",
    "audio_source_kind",
    "analysis_mode",
    "co_created_run_id",
    "baseline_run_id",
    "co_created_total_ms",
    "baseline_total_ms",
    "questionnaire_complete",
    "generation_complete",
    "baseline_complete",
    ...ARTWORK_SCORE_FIELDS.map(([field]) => field),
    "music_match_choice",
    "imagination_match_choice",
    "overall_choice",
    "comparison_reason",
    ...MANIPULATION_SCORE_FIELDS.map(([field]) => field),
    "issue_codes",
  ];
  const lines = trials.map((trial) => {
    const values: Record<string, unknown> = {
      trial_id: trial.id,
      participant_id: trial.participantId,
      session_id: trial.sessionId,
      condition: trial.condition,
      assignment_method: trial.assignmentMethod,
      protocol_version: trial.protocolVersion,
      status: trial.status,
      created_at: trial.createdAt,
      music_title: trial.musicTitle,
      audio_source_kind: trial.audioSourceKind,
      analysis_mode: trial.analysisMode,
      co_created_run_id: trial.coCreatedRun?.id,
      baseline_run_id: trial.baselineRun?.id,
      co_created_total_ms: trial.coCreatedRun?.totalMs,
      baseline_total_ms: trial.baselineRun?.totalMs,
      questionnaire_complete: trial.questionnaireComplete,
      generation_complete: trial.generationComplete,
      baseline_complete: trial.baselineComplete,
      music_match_choice: trial.comparison?.musicMatchChoice,
      imagination_match_choice: trial.comparison?.imaginationMatchChoice,
      overall_choice: trial.comparison?.overallChoice,
      comparison_reason: trial.comparison?.reason,
      issue_codes: trial.issues.map((item) => item.code).join("|"),
    };
    for (const [field] of ARTWORK_SCORE_FIELDS) {
      values[field] = trial.artworkEvaluation?.[field];
    }
    for (const [field] of MANIPULATION_SCORE_FIELDS) {
      values[field] = trial.manipulationCheck?.[field];
    }
    return headers.map((header) => csvValue(values[header])).join(",");
  });
  return `\uFEFF${headers.join(",")}\n${lines.join("\n")}\n`;
}
