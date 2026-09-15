import { exportExperimentJson } from "@/lib/db/export";
import {
  buildResearchDeletionPlan,
  purgeLocalResearchData,
  recordLocalResearchAdminAction,
  upsertLocalResearchAnnotations,
  type ResearchAnnotationInput,
  type ResearchTarget,
} from "@/lib/research-admin";
import { isLocalResearchMutationRequest } from "@/lib/research-access";
import {
  fetchSupabaseResearchExport,
  getRemoteSupabaseResearchConfig,
  purgeSupabaseResearchData,
  recordSupabaseResearchAdminAction,
  upsertSupabaseResearchAnnotations,
} from "@/lib/research-remote";
import type { ResearchClassification, ResearchEntityType } from "@/lib/research-dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ManagementSource = "local" | "online";
type ManagementAction = "preview" | "annotate" | "trash" | "restore" | "purge";

interface ManagementRequest {
  action?: ManagementAction;
  source?: ManagementSource;
  targets?: ResearchTarget[];
  annotation?: {
    classification?: ResearchClassification;
    cohortLabel?: string;
    protected?: boolean;
    excludedFromAnalysis?: boolean;
    note?: string;
  };
  confirmation?: string;
}

const ENTITY_TYPES = new Set<ResearchEntityType>(["study_session", "trial", "generation_run"]);
const CLASSIFICATIONS = new Set<ResearchClassification>([
  "unclassified", "formal", "pilot", "test", "excluded",
]);

function parseTargets(value: unknown): ResearchTarget[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    throw new Error("请选择 1 至 100 条实验数据");
  }
  const targets = value.map((item) => {
    if (!item || typeof item !== "object") throw new Error("实验数据目标无效");
    const entityType = String((item as { entityType?: unknown }).entityType || "") as ResearchEntityType;
    const entityId = String((item as { entityId?: unknown }).entityId || "").trim();
    if (!ENTITY_TYPES.has(entityType) || !entityId || entityId.length > 200) {
      throw new Error("实验数据目标无效");
    }
    return { entityType, entityId };
  });
  return [...new Map(targets.map((target) => [`${target.entityType}:${target.entityId}`, target])).values()];
}

function currentAnnotation(
  snapshot: Awaited<ReturnType<typeof exportExperimentJson>> | Record<string, unknown>,
  target: ResearchTarget
): ResearchAnnotationInput {
  const annotations = Array.isArray(snapshot.annotations)
    ? snapshot.annotations as Array<Record<string, unknown>>
    : [];
  const existing = annotations.find((record) => (
    record.entity_type === target.entityType && record.entity_id === target.entityId
  ));
  return {
    ...target,
    classification: CLASSIFICATIONS.has(existing?.classification as ResearchClassification)
      ? existing?.classification as ResearchClassification
      : "unclassified",
    cohortLabel: typeof existing?.cohort_label === "string" ? existing.cohort_label : "",
    protected: existing?.protected === true || existing?.protected === 1,
    excludedFromAnalysis: existing?.excluded_from_analysis === true
      || existing?.excluded_from_analysis === 1,
    trashedAt: typeof existing?.trashed_at === "string" ? existing.trashed_at : null,
    note: typeof existing?.note === "string" ? existing.note : "",
  };
}

function annotationInputs(
  snapshot: Awaited<ReturnType<typeof exportExperimentJson>> | Record<string, unknown>,
  targets: ResearchTarget[],
  action: ManagementAction,
  patch: ManagementRequest["annotation"]
): ResearchAnnotationInput[] {
  return targets.map((target) => {
    const current = currentAnnotation(snapshot, target);
    if (action === "trash") return { ...current, trashedAt: new Date().toISOString() };
    if (action === "restore") return { ...current, trashedAt: null };
    const nextClassification = patch?.classification || current.classification;
    return {
      ...current,
      classification: nextClassification,
      cohortLabel: patch?.cohortLabel ?? current.cohortLabel,
      protected: patch?.protected ?? (nextClassification === "formal" || nextClassification === "pilot"),
      excludedFromAnalysis: patch?.excludedFromAnalysis
        ?? (nextClassification === "test" || nextClassification === "excluded"),
      note: patch?.note ?? current.note,
    };
  });
}

export async function POST(request: Request) {
  if (!isLocalResearchMutationRequest(request.headers)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const body = await request.json() as ManagementRequest;
    const action = body.action;
    const source = body.source;
    if (!action || !["preview", "annotate", "trash", "restore", "purge"].includes(action)) {
      throw new Error("管理操作无效");
    }
    if (source !== "local" && source !== "online") throw new Error("请选择本地或线上数据源");
    const targets = parseTargets(body.targets);
    const remoteConfig = source === "online" ? getRemoteSupabaseResearchConfig() : null;
    if (source === "online" && !remoteConfig) throw new Error("线上研究数据库未配置");
    const snapshot = source === "online"
      ? await fetchSupabaseResearchExport(remoteConfig!) as Record<string, unknown>
      : await exportExperimentJson();

    if (action === "preview") {
      return Response.json({ plan: buildResearchDeletionPlan(snapshot, targets) });
    }

    if (action === "purge") {
      if (body.confirmation !== `永久删除 ${targets.length} 条实验数据`) {
        throw new Error("永久删除确认文字不匹配");
      }
      const plan = buildResearchDeletionPlan(snapshot, targets);
      if (plan.protectedTargets.length > 0) {
        return Response.json({ error: "所选内容包含受保护的正式或预实验数据，请先取消保护" }, { status: 409 });
      }
      if (source === "online") {
        const result = await purgeSupabaseResearchData(remoteConfig!, plan);
        await recordSupabaseResearchAdminAction(remoteConfig!, {
          action, targets, source, affectedCounts: result.affectedCounts,
        });
        return Response.json({ ok: true, plan, result });
      }
      const result = await purgeLocalResearchData(snapshot, plan);
      await recordLocalResearchAdminAction({
        action, targets, source, affectedCounts: plan.counts, backupRef: result.backupRef,
      });
      return Response.json({ ok: true, plan, result });
    }

    const annotations = annotationInputs(snapshot, targets, action, body.annotation);
    if ((action === "trash") && annotations.some((annotation) => annotation.protected)) {
      return Response.json({ error: "受保护的正式或预实验数据不能移入回收站" }, { status: 409 });
    }
    if (source === "online") {
      await upsertSupabaseResearchAnnotations(remoteConfig!, annotations);
      await recordSupabaseResearchAdminAction(remoteConfig!, { action, targets, source });
    } else {
      await upsertLocalResearchAnnotations(annotations);
      await recordLocalResearchAdminAction({ action, targets, source });
    }
    return Response.json({ ok: true, annotations });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "实验数据管理失败" },
      { status: 400 }
    );
  }
}
