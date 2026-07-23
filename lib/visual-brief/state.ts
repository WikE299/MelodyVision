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

export type VisualBriefSlotKey = "scene" | "dynamics" | "sensory" | "meaning";
export type VisualBriefSlotStatus = "filled" | "partial" | "missing" | "conflicted";

export interface VisualBriefSlotAssessment {
  key: VisualBriefSlotKey;
  status: VisualBriefSlotStatus;
  presentFields: VisualBriefFieldKey[];
  missingFields: VisualBriefFieldKey[];
}

export const VISUAL_BRIEF_SLOTS: Record<VisualBriefSlotKey, VisualBriefFieldKey[]> = {
  scene: ["subject", "space"],
  dynamics: ["motion", "composition"],
  sensory: ["materials", "palette", "lighting"],
  meaning: ["personalMeaning", "mustInclude", "mustAvoid"],
};

const SLOT_LABELS: Record<VisualBriefSlotKey, string> = {
  scene: "场景与空间",
  dynamics: "变化与画面关系",
  sensory: "光色与质地",
  meaning: "核心感受与限制",
};

function missingField<T>(): VisualBriefField<T> {
  return { value: null, status: "missing", sources: [] };
}

export function assessVisualBriefSlots(
  fields: VisualBriefFields
): VisualBriefSlotAssessment[] {
  return (Object.keys(VISUAL_BRIEF_SLOTS) as VisualBriefSlotKey[]).map((key) => {
    const slotFields = VISUAL_BRIEF_SLOTS[key];
    const presentFields = slotFields.filter(
      (fieldKey) => fields[fieldKey].status !== "missing" && fields[fieldKey].value !== null
    );
    const confirmedFields = slotFields.filter(
      (fieldKey) => fields[fieldKey].status === "confirmed" && fields[fieldKey].value !== null
    );
    const conflicted = slotFields.some((fieldKey) => fields[fieldKey].status === "conflicted");
    const status: VisualBriefSlotStatus = conflicted
      ? "conflicted"
      : confirmedFields.length > 0
        ? "filled"
        : presentFields.length > 0
          ? "partial"
          : "missing";

    return {
      key,
      status,
      presentFields,
      missingFields: slotFields.filter((fieldKey) => !presentFields.includes(fieldKey)),
    };
  });
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
  const slots = assessVisualBriefSlots(fields);
  const filledSlots = slots.filter((slot) => slot.status === "filled").length;
  const partialSlots = slots.filter((slot) => slot.status === "partial").length;
  const score = Math.max(
    0,
    Math.min(1, (filledSlots + partialSlots * 0.5) / slots.length - conflictedFields.length * 0.05)
  );
  const ready = slots.every((slot) => slot.status === "filled");
  const reasons: string[] = [];

  const unresolvedSlots = slots.filter((slot) => slot.status !== "filled");
  if (unresolvedSlots.length > 0) {
    reasons.push(`还需要澄清：${unresolvedSlots.map((slot) => SLOT_LABELS[slot.key]).join("、")}`);
  }
  if (conflictedFields.length) reasons.push(`仍有冲突字段：${conflictedFields.join("、")}`);
  if (ready) reasons.push("四个画面槽位均已满足，不需要继续补填");

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
