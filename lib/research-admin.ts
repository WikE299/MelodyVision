import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDatabase } from "./db/index.ts";
import {
  parseExperimentExport,
  type RawExperimentExport,
  type ResearchClassification,
  type ResearchEntityType,
} from "./research-dashboard.ts";

type RawRecord = Record<string, unknown>;
type ExportArrayKey = Exclude<keyof RawExperimentExport, "schemaVersion" | "exportedAt">;

export interface ResearchTarget {
  entityType: ResearchEntityType;
  entityId: string;
}

export interface ResearchAnnotationInput extends ResearchTarget {
  classification: ResearchClassification;
  cohortLabel: string;
  protected: boolean;
  excludedFromAnalysis: boolean;
  trashedAt: string | null;
  note: string;
}

export interface ResearchDeletionPlan {
  targets: ResearchTarget[];
  idsByTable: Record<string, string[]>;
  counts: Record<string, number>;
  images: Array<{
    runId: string;
    imageUrl: string;
    remoteImageUrl: string;
  }>;
  protectedTargets: ResearchTarget[];
  warnings: string[];
}

const ID_TABLE_KEYS: Record<string, ExportArrayKey> = {
  experiment_sessions: "sessions",
  study_sessions: "studySessions",
  session_comparisons: "sessionComparisons",
  audio_analyses: "audioAnalyses",
  conversation_snapshots: "conversationSnapshots",
  visual_brief_versions: "visualBriefVersions",
  interaction_events: "interactionEvents",
  generation_runs: "runs",
  generation_feedback: "feedback",
  study_trials: "trials",
  artwork_evaluations: "artworkEvaluations",
  pairwise_comparisons: "pairwiseComparisons",
  labeled_comparisons: "labeledComparisons",
  manipulation_checks: "manipulationChecks",
  questionnaire_responses: "questionnaireResponses",
};

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function annotationRecord(
  data: RawExperimentExport,
  target: ResearchTarget
): RawRecord | undefined {
  return data.annotations.find((record) => (
    text(record.entity_type) === target.entityType && text(record.entity_id) === target.entityId
  ));
}

function directOrInheritedAnnotation(
  data: RawExperimentExport,
  target: ResearchTarget
): RawRecord | undefined {
  const direct = annotationRecord(data, target);
  if (direct) return direct;
  const trial = target.entityType === "trial"
    ? data.trials.find((record) => text(record.id) === target.entityId)
    : target.entityType === "generation_run"
      ? data.trials.find((record) => (
        text(record.co_created_run_id) === target.entityId
        || text(record.baseline_run_id) === target.entityId
        || text(data.runs.find((run) => text(run.id) === target.entityId)?.trial_id) === text(record.id)
      ))
      : undefined;
  if (!trial) return undefined;
  const trialAnnotation = annotationRecord(data, { entityType: "trial", entityId: text(trial.id) });
  if (trialAnnotation) return trialAnnotation;
  const studySessionId = text(trial?.study_session_id);
  return studySessionId
    ? annotationRecord(data, { entityType: "study_session", entityId: studySessionId })
    : undefined;
}

function recordsForTrial(
  records: RawRecord[],
  trial: RawRecord,
  allTrials: RawRecord[]
): RawRecord[] {
  const trialId = text(trial.id);
  const sessionId = text(trial.session_id);
  const startedAt = Date.parse(text(trial.created_at));
  const nextTrialAt = allTrials
    .filter((candidate) => (
      text(candidate.session_id) === sessionId
      && Date.parse(text(candidate.created_at)) > startedAt
    ))
    .reduce<number | null>((selected, candidate) => {
      const candidateTime = Date.parse(text(candidate.created_at));
      return selected === null || candidateTime < selected ? candidateTime : selected;
    }, null);
  return records.filter((record) => {
    if (text(record.trial_id) === trialId) return true;
    if (text(record.trial_id) || text(record.session_id) !== sessionId) return false;
    const recordTime = Date.parse(text(record.created_at));
    return Number.isFinite(recordTime)
      && recordTime >= startedAt
      && (nextTrialAt === null || recordTime < nextTrialAt);
  });
}

export function buildResearchDeletionPlan(
  value: unknown,
  targets: ResearchTarget[]
): ResearchDeletionPlan {
  const data = parseExperimentExport(value);
  const normalizedTargets = targets.filter((target) => (
    target.entityId
    && ["study_session", "trial", "generation_run"].includes(target.entityType)
  ));
  const selectedStudySessionIds = new Set(
    normalizedTargets.filter((target) => target.entityType === "study_session").map((target) => target.entityId)
  );
  const selectedTrialIds = new Set(
    normalizedTargets.filter((target) => target.entityType === "trial").map((target) => target.entityId)
  );
  for (const trial of data.trials) {
    if (selectedStudySessionIds.has(text(trial.study_session_id))) selectedTrialIds.add(text(trial.id));
  }
  const selectedTrials = data.trials.filter((trial) => selectedTrialIds.has(text(trial.id)));
  const selectedRunIds = new Set(
    normalizedTargets.filter((target) => target.entityType === "generation_run").map((target) => target.entityId)
  );
  for (const trial of selectedTrials) {
    selectedRunIds.add(text(trial.co_created_run_id));
    selectedRunIds.add(text(trial.baseline_run_id));
    for (const run of recordsForTrial(data.runs, trial, data.trials)) selectedRunIds.add(text(run.id));
  }
  selectedRunIds.delete("");

  const collectScopedIds = (records: RawRecord[]) => unique(selectedTrials.flatMap(
    (trial) => recordsForTrial(records, trial, data.trials).map((record) => text(record.id))
  ));
  const selectedSessionIds = unique(selectedTrials.map((trial) => text(trial.session_id)));
  const removableExperimentSessionIds = selectedSessionIds.filter((sessionId) => (
    !data.trials.some((trial) => (
      text(trial.session_id) === sessionId && !selectedTrialIds.has(text(trial.id))
    ))
  ));
  const runIds = unique([...selectedRunIds]);
  const idsByTable: Record<string, string[]> = {
    generation_feedback: unique(data.feedback
      .filter((record) => selectedRunIds.has(text(record.run_id)))
      .map((record) => text(record.id))),
    questionnaire_responses: unique(data.questionnaireResponses
      .filter((record) => (
        selectedTrialIds.has(text(record.trial_id))
        || selectedStudySessionIds.has(text(record.study_session_id))
      ))
      .map((record) => text(record.id))),
    session_comparisons: unique(data.sessionComparisons
      .filter((record) => selectedStudySessionIds.has(text(record.study_session_id)))
      .map((record) => text(record.id))),
    artwork_evaluations: unique(data.artworkEvaluations
      .filter((record) => selectedTrialIds.has(text(record.trial_id)))
      .map((record) => text(record.id))),
    pairwise_comparisons: unique(data.pairwiseComparisons
      .filter((record) => selectedTrialIds.has(text(record.trial_id)))
      .map((record) => text(record.id))),
    labeled_comparisons: unique(data.labeledComparisons
      .filter((record) => selectedTrialIds.has(text(record.trial_id)))
      .map((record) => text(record.id))),
    manipulation_checks: unique(data.manipulationChecks
      .filter((record) => selectedTrialIds.has(text(record.trial_id)))
      .map((record) => text(record.id))),
    baseline_jobs: unique(data.baselineJobs
      .filter((record) => selectedTrialIds.has(text(record.trial_id)))
      .map((record) => text(record.trial_id))),
    audio_analyses: collectScopedIds(data.audioAnalyses),
    conversation_snapshots: collectScopedIds(data.conversationSnapshots),
    visual_brief_versions: collectScopedIds(data.visualBriefVersions),
    interaction_events: collectScopedIds(data.interactionEvents),
    generation_runs: runIds,
    study_trials: unique([...selectedTrialIds]),
    study_sessions: unique([...selectedStudySessionIds]),
    experiment_sessions: removableExperimentSessionIds.filter((id) => (
      data.sessions.some((record) => text(record.id) === id)
    )),
    annotation_study_session_ids: unique([...selectedStudySessionIds]),
    annotation_trial_ids: unique([...selectedTrialIds]),
    annotation_generation_run_ids: runIds,
  };
  const selectedRuns = data.runs.filter((run) => selectedRunIds.has(text(run.id)));
  const protectedTargets = normalizedTargets.filter((target) => {
    const annotation = directOrInheritedAnnotation(data, target);
    return annotation?.protected === true || annotation?.protected === 1;
  });
  const warnings: string[] = [];
  if (selectedStudySessionIds.size === 0 && selectedTrialIds.size > 0) {
    warnings.push("单独删除 Trial 可能使其所属实验会话变为不完整状态");
  }
  if (selectedRuns.some((run) => !text(run.image_url))) {
    warnings.push("部分生图记录没有可清理的图片地址");
  }
  const counts = Object.fromEntries(Object.entries(idsByTable).map(([table, ids]) => [table, ids.length]));
  return {
    targets: normalizedTargets,
    idsByTable,
    counts,
    images: selectedRuns.map((run) => ({
      runId: text(run.id),
      imageUrl: text(run.image_url),
      remoteImageUrl: text(run.remote_image_url),
    })),
    protectedTargets,
    warnings,
  };
}

export async function upsertLocalResearchAnnotations(
  annotations: ResearchAnnotationInput[]
): Promise<void> {
  const database = await getDatabase();
  const now = new Date().toISOString();
  await database.transaction(async (transaction) => {
    for (const annotation of annotations) {
      await transaction.prepare(`
        INSERT INTO research_data_annotations (
          entity_type, entity_id, classification, cohort_label, protected,
          excluded_from_analysis, trashed_at, note, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(entity_type, entity_id) DO UPDATE SET
          classification = excluded.classification,
          cohort_label = excluded.cohort_label,
          protected = excluded.protected,
          excluded_from_analysis = excluded.excluded_from_analysis,
          trashed_at = excluded.trashed_at,
          note = excluded.note,
          updated_at = excluded.updated_at
      `).run(
        annotation.entityType,
        annotation.entityId,
        annotation.classification,
        annotation.cohortLabel,
        annotation.protected ? 1 : 0,
        annotation.excludedFromAnalysis ? 1 : 0,
        annotation.trashedAt,
        annotation.note,
        now
      );
    }
  });
}

export async function recordLocalResearchAdminAction(input: {
  action: string;
  targets: ResearchTarget[];
  source: string;
  affectedCounts?: Record<string, number>;
  backupRef?: string;
}): Promise<void> {
  const database = await getDatabase();
  await database.prepare(`
    INSERT INTO research_admin_actions (
      id, action, target_type, target_ids_json, source,
      affected_counts_json, backup_ref, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(),
    input.action,
    [...new Set(input.targets.map((target) => target.entityType))].join("|"),
    JSON.stringify(input.targets.map((target) => target.entityId)),
    input.source,
    JSON.stringify(input.affectedCounts || {}),
    input.backupRef || "",
    new Date().toISOString()
  );
}

function selectedBackupRecords(data: RawExperimentExport, plan: ResearchDeletionPlan) {
  const records = Object.fromEntries(Object.entries(ID_TABLE_KEYS).map(([table, key]) => {
    const ids = new Set(plan.idsByTable[table] || []);
    const idField = table === "baseline_jobs" ? "trial_id" : "id";
    return [key, data[key].filter((record) => ids.has(text(record[idField])))];
  }));
  const annotationIds = {
    study_session: new Set(plan.idsByTable.annotation_study_session_ids || []),
    trial: new Set(plan.idsByTable.annotation_trial_ids || []),
    generation_run: new Set(plan.idsByTable.annotation_generation_run_ids || []),
  };
  return {
    ...records,
    annotations: data.annotations.filter((record) => {
      const entityType = text(record.entity_type) as keyof typeof annotationIds;
      return entityType in annotationIds && annotationIds[entityType].has(text(record.entity_id));
    }),
  };
}

async function deleteIds(
  database: Awaited<ReturnType<typeof getDatabase>>,
  table: string,
  field: string,
  ids: string[]
) {
  if (ids.length === 0) return;
  await database.prepare(
    `DELETE FROM ${table} WHERE ${field} IN (${ids.map(() => "?").join(",")})`
  ).run(...ids);
}

function localImagePath(imageUrl: string, runId: string): string | null {
  if (!imageUrl.startsWith("/generated/")) return null;
  const fileName = path.basename(imageUrl);
  if (path.parse(fileName).name !== runId || !/\.(png|jpe?g|webp)$/i.test(fileName)) return null;
  return path.join(process.cwd(), "public", "generated", fileName);
}

export async function purgeLocalResearchData(
  value: unknown,
  plan: ResearchDeletionPlan
): Promise<{ backupRef: string; deletedImages: number; imageErrors: string[] }> {
  if (plan.protectedTargets.length > 0) throw new Error("受保护的实验数据不能永久删除");
  const data = parseExperimentExport(value);
  const backupDirectory = path.join(process.cwd(), "data", "research-backups");
  await mkdir(backupDirectory, { recursive: true });
  const backupRef = path.join(backupDirectory, `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}.json`);
  await writeFile(backupRef, JSON.stringify({
    createdAt: new Date().toISOString(),
    plan,
    records: selectedBackupRecords(data, plan),
  }, null, 2));

  const database = await getDatabase();
  await database.transaction(async (transaction) => {
    const order: Array<[string, string]> = [
      ["generation_feedback", "id"],
      ["questionnaire_responses", "id"],
      ["session_comparisons", "id"],
      ["artwork_evaluations", "id"],
      ["pairwise_comparisons", "id"],
      ["labeled_comparisons", "id"],
      ["manipulation_checks", "id"],
      ["baseline_jobs", "trial_id"],
      ["audio_analyses", "id"],
      ["conversation_snapshots", "id"],
      ["visual_brief_versions", "id"],
      ["interaction_events", "id"],
      ["generation_runs", "id"],
      ["study_trials", "id"],
      ["study_sessions", "id"],
      ["experiment_sessions", "id"],
    ];
    for (const [table, field] of order) {
      await deleteIds(transaction, table, field, plan.idsByTable[table] || []);
    }
    for (const [entityType, key] of [
      ["study_session", "annotation_study_session_ids"],
      ["trial", "annotation_trial_ids"],
      ["generation_run", "annotation_generation_run_ids"],
    ] as const) {
      const ids = plan.idsByTable[key] || [];
      if (ids.length === 0) continue;
      await transaction.prepare(
        `DELETE FROM research_data_annotations WHERE entity_type = ? AND entity_id IN (${ids.map(() => "?").join(",")})`
      ).run(entityType, ...ids);
    }
  });

  let deletedImages = 0;
  const imageErrors: string[] = [];
  for (const image of plan.images) {
    const filePath = localImagePath(image.imageUrl, image.runId);
    if (!filePath) continue;
    try {
      await rm(filePath);
      deletedImages += 1;
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
      if (code !== "ENOENT") imageErrors.push(`${image.runId}:${code}`);
    }
  }
  return { backupRef, deletedImages, imageErrors };
}
