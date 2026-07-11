import type {
  VisualBrief,
  VisualBriefField,
  VisualBriefFieldKey,
  VisualBriefFields,
  VisualBriefReadiness,
} from "../contracts/visual-brief.ts";
import { VERSION_2_SCHEMA_VERSION } from "../contracts/shared.ts";

export const VISUAL_BRIEF_FIELD_KEYS: VisualBriefFieldKey[] = [
  "subject",
  "space",
  "composition",
  "motion",
  "materials",
  "palette",
  "lighting",
  "atmosphere",
  "personalMeaning",
  "mustInclude",
  "mustAvoid",
];

const CORE_READINESS_FIELDS: VisualBriefFieldKey[] = [
  "subject",
  "space",
  "composition",
  "motion",
  "materials",
  "palette",
  "lighting",
  "atmosphere",
  "personalMeaning",
];

function missingField<T>(): VisualBriefField<T> {
  return { value: null, status: "missing", sources: [] };
}

export function createEmptyVisualBrief(input: {
  id?: string;
  conversationId: string;
  musicProfileId: string;
  now?: string;
}): VisualBrief {
  const timestamp = input.now || new Date().toISOString();
  const fields: VisualBriefFields = {
    subject: missingField<string>(),
    space: missingField<string>(),
    composition: missingField<string>(),
    motion: missingField<string[]>(),
    materials: missingField<string[]>(),
    palette: missingField<string[]>(),
    lighting: missingField<string>(),
    atmosphere: missingField<string[]>(),
    personalMeaning: missingField<string>(),
    mustInclude: missingField<string[]>(),
    mustAvoid: missingField<string[]>(),
  };

  return {
    schemaVersion: VERSION_2_SCHEMA_VERSION,
    id: input.id || crypto.randomUUID(),
    conversationId: input.conversationId,
    musicProfileId: input.musicProfileId,
    version: 0,
    status: "collecting",
    fields,
    readiness: calculateVisualBriefReadiness(fields),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function calculateVisualBriefReadiness(
  fields: VisualBriefFields
): VisualBriefReadiness {
  const presentFields = VISUAL_BRIEF_FIELD_KEYS.filter(
    (key) => fields[key].status !== "missing" && fields[key].value !== null
  );
  const missingFields = VISUAL_BRIEF_FIELD_KEYS.filter((key) => !presentFields.includes(key));
  const conflictedFields = VISUAL_BRIEF_FIELD_KEYS.filter(
    (key) => fields[key].status === "conflicted"
  );
  const corePresent = CORE_READINESS_FIELDS.filter((key) => presentFields.includes(key));
  const rawScore = corePresent.length / CORE_READINESS_FIELDS.length;
  const score = Math.max(0, Math.min(1, rawScore - conflictedFields.length * 0.05));
  const hasAnchor = presentFields.includes("subject") && (
    presentFields.includes("space") || presentFields.includes("composition")
  );
  const hasUserMeaning = fields.personalMeaning.status === "confirmed";
  const ready = score >= 0.6 && hasAnchor && hasUserMeaning;
  const reasons: string[] = [];

  if (!hasAnchor) reasons.push("仍缺少明确主体及空间或构图锚点");
  if (!hasUserMeaning) reasons.push("尚未确认用户自己的画面意义");
  if (conflictedFields.length) reasons.push(`仍有冲突字段：${conflictedFields.join("、")}`);
  if (ready) reasons.push("核心画面线索和用户意义已经可以支持生成");

  return {
    score: Math.round(score * 1000) / 1000,
    ready,
    presentFields,
    missingFields,
    conflictedFields,
    reasons,
  };
}

export function parseVisualBrief(value: unknown): VisualBrief | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const brief = value as Partial<VisualBrief>;
  const arrayFields = new Set<VisualBriefFieldKey>([
    "motion",
    "materials",
    "palette",
    "atmosphere",
    "mustInclude",
    "mustAvoid",
  ]);
  const fields = brief.fields as unknown as Record<string, unknown> | undefined;
  if (
    brief.schemaVersion !== VERSION_2_SCHEMA_VERSION ||
    typeof brief.id !== "string" ||
    typeof brief.conversationId !== "string" ||
    typeof brief.musicProfileId !== "string" ||
    typeof brief.version !== "number" ||
    !fields ||
    typeof fields !== "object" ||
    !VISUAL_BRIEF_FIELD_KEYS.every((key) => {
      const field = fields[key];
      if (!field || typeof field !== "object" || Array.isArray(field)) return false;
      const candidate = field as { value?: unknown; status?: unknown; sources?: unknown };
      if (
        !["missing", "suggested", "confirmed", "conflicted"].includes(String(candidate.status)) ||
        !Array.isArray(candidate.sources)
      ) {
        return false;
      }
      if (candidate.status === "missing") return candidate.value === null;
      return arrayFields.has(key)
        ? Array.isArray(candidate.value) && candidate.value.every((item) => typeof item === "string")
        : typeof candidate.value === "string";
    })
  ) {
    return null;
  }
  return brief as VisualBrief;
}
