"use client";

/* eslint-disable @next/next/no-img-element */

import {
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  buildResearchDashboardDataset,
  exportResearchStudySessionsCsv,
  exportResearchTrialsCsv,
  mergeResearchDashboardDatasets,
  summarizeResearchTrials,
  type ResearchCondition,
  type ResearchDataOrigin,
  type ResearchDashboardDataset,
  type ResearchDataIssue,
  type ResearchScoreMetric,
  type ResearchStudySessionRecord,
  type ResearchTrialRecord,
} from "@/lib/research-dashboard";
import { buildResearchThumbnailUrl } from "@/lib/research-thumbnail";
import {
  usesIntegratedQuestionnaires,
  usesStreamlinedQuestionnaires,
} from "@/lib/contracts";

type View = "overview" | "trials" | "questionnaires" | "quality";

type QuestionnaireRow = {
  id: string;
  participantId: string;
  studySessionId: string;
  trialId: string;
  period: number | null;
  condition: ResearchCondition;
  instrument: string;
  generationRole: string;
  status: string;
  totalScore: number | null;
  questionnaireVersion: string;
  completedAt: string;
  answers: unknown;
  metrics: unknown;
  trial: ResearchTrialRecord | null;
};

interface Filters {
  origin: "all" | "local" | "online" | "snapshot";
  condition: "all" | ResearchCondition;
  protocol: string;
  status: string;
  questionnaire: "all" | "complete" | "incomplete";
  issue: "all" | "with-issues" | "without-issues";
  from: string;
  to: string;
  query: string;
}

const DATE_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const FULL_DATE_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const DATE_INPUT_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const CONDITION_LABELS: Record<ResearchCondition, string> = {
  multi_agent: "音乐家共同聆听",
  single_agent: "单一共创引导",
  unknown: "未知条件",
};

const STATUS_LABELS: Record<string, string> = {
  created: "已创建",
  interacting: "交互中",
  generating: "生成中",
  evaluating: "评价中",
  completed: "已完成",
};

const STUDY_SESSION_STATUS_LABELS: Record<string, string> = {
  created: "等待体验 1",
  period_1: "体验 1 进行中",
  between_periods: "等待体验 2",
  period_2: "体验 2 进行中",
  comparing: "体验对比中",
  baseline_review: "参照对比中",
  completed: "已完成",
};

const QUESTIONNAIRE_LABELS: Record<string, string> = {
  background: "背景问卷",
  image_alignment: "图像契合度",
  csi: "创造支持指数（CSI）",
  agency_ownership: "主体感与所有权",
  sus: "系统可用性（SUS）",
  raw_tlx: "任务负荷（Raw NASA-TLX）",
  manipulation_check: "交互检验",
  session_preference: "总体偏好",
  csi_weighting: "CSI 因子权重",
};

const GENERATION_ROLE_LABELS: Record<string, string> = {
  co_created: "共创作品",
  direct_baseline: "音乐直出作品",
};

const DATA_ORIGIN_LABELS: Record<ResearchDataOrigin, string> = {
  local: "本地",
  online: "线上",
  online_cache: "线上缓存",
  snapshot: "导入快照",
};

function DataOriginBadges({ origins }: { origins: ResearchDataOrigin[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {origins.map((origin) => (
        <span
          key={origin}
          className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ring-1 ring-inset ${
            origin === "local"
              ? "bg-blue-50 text-blue-700 ring-blue-200"
              : origin === "online"
                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                : origin === "online_cache"
                  ? "bg-amber-50 text-amber-700 ring-amber-200"
                  : "bg-violet-50 text-violet-700 ring-violet-200"
          }`}
        >
          {DATA_ORIGIN_LABELS[origin]}
        </span>
      ))}
    </div>
  );
}

const INITIAL_FILTERS: Filters = {
  origin: "all",
  condition: "all",
  protocol: "all",
  status: "all",
  questionnaire: "all",
  issue: "all",
  from: "",
  to: "",
  query: "",
};

function formatDate(value: string, full = false): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "未记录";
  return (full ? FULL_DATE_FORMATTER : DATE_FORMATTER).format(timestamp);
}

function formatDuration(value: number | null | undefined): string {
  if (value === null || value === undefined) return "未记录";
  return value >= 1000 ? `${(value / 1000).toFixed(1)} 秒` : `${value} 毫秒`;
}

function localDateValue(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "";
  const parts = DATE_INPUT_FORMATTER.formatToParts(timestamp);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function shortId(value: string): string {
  if (!value) return "未记录";
  if (value.startsWith("anonymous-")) return `anonymous-${value.slice(-8)}`;
  return value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function scoreValue(record: Record<string, unknown> | null, key: string): string {
  const value = Number(record?.[key]);
  return Number.isFinite(value) ? String(value) : "未采集";
}

function choiceLabel(value: string | null | undefined): string {
  if (value === "co_created") return "共创作品";
  if (value === "direct_baseline") return "音乐直出作品";
  if (value === "tie") return "两者相近";
  return "未采集";
}

function sessionChoiceLabel(value: unknown): string {
  if (value === "period_1") return "体验 1";
  if (value === "period_2") return "体验 2";
  if (value === "tie") return "两者相近";
  return "未采集";
}

function sessionPreferenceChoice(session: ResearchStudySessionRecord): unknown {
  const response = session.questionnaireResponses.find((item) => (
    textValue(item.instrument) === "session_preference"
    && textValue(item.status) === "completed"
  ));
  if (response?.answers && typeof response.answers === "object") {
    return (response.answers as Record<string, unknown>).SESSION_PREFERENCE;
  }
  return session.comparison?.overall_choice;
}

function protocolLabel(value: string, currentProtocolVersion: string): string {
  if (value === currentProtocolVersion) return "当前实验版本";
  if (value === "v2-13-blind-comparison") return "历史版本 · 盲测流程";
  return `历史版本 · ${value}`;
}

function sequenceLabel(value: string): string {
  const labels: Record<string, string> = {
    single_x_then_multi_y: "单一引导 X → 音乐家共听 Y",
    multi_x_then_single_y: "音乐家共听 X → 单一引导 Y",
    single_y_then_multi_x: "单一引导 Y → 音乐家共听 X",
    multi_y_then_single_x: "音乐家共听 Y → 单一引导 X",
  };
  return labels[value] || value || "未记录";
}

function questionnaireScore(
  trial: ResearchTrialRecord,
  instrument: string,
  generationRole?: string
): number | null {
  const response = trial.questionnaireResponses.find((item) => (
    textValue(item.instrument) === instrument
    && textValue(item.status) === "completed"
    && (!generationRole || textValue(item.generation_role) === generationRole)
  ));
  const score = Number(response?.score_total);
  return Number.isFinite(score) ? score : null;
}

function questionnaireMetric(
  trial: ResearchTrialRecord,
  instrument: string,
  metric: string
): number | null {
  const response = trial.questionnaireResponses.find((item) => (
    textValue(item.instrument) === instrument && textValue(item.status) === "completed"
  ));
  const metrics = response?.metrics && typeof response.metrics === "object"
    ? response.metrics as Record<string, unknown>
    : {};
  const value = Number(metrics[metric]);
  return Number.isFinite(value) ? value : null;
}

function meanQuestionnaireScore(
  trials: ResearchTrialRecord[],
  condition: ResearchCondition,
  instrument: string,
  generationRole?: string
): { mean: number | null; count: number } {
  const values = trials
    .filter((trial) => trial.condition === condition)
    .map((trial) => questionnaireScore(trial, instrument, generationRole))
    .filter((value): value is number => value !== null);
  return {
    mean: values.length
      ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100
      : null,
    count: values.length,
  };
}

function downloadText(contents: string, fileName: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function SectionTitle({
  title,
  description,
  trailing,
}: {
  title: string;
  description?: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
        {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
      </div>
      {trailing}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "teal" | "blue" | "amber" | "rose" | "zinc";
}) {
  const toneClasses = {
    teal: "border-teal-200 bg-teal-50/70 text-teal-800",
    blue: "border-blue-200 bg-blue-50/70 text-blue-800",
    amber: "border-amber-200 bg-amber-50/70 text-amber-800",
    rose: "border-rose-200 bg-rose-50/70 text-rose-800",
    zinc: "border-zinc-200 bg-white text-zinc-800",
  };
  return (
    <article className={`min-h-28 rounded-md border p-4 ${toneClasses[tone]}`}>
      <p className="text-xs font-semibold uppercase text-zinc-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
      <p className="mt-2 text-xs text-zinc-500">{detail}</p>
    </article>
  );
}

function ScoreDistribution({ metric }: { metric: ResearchScoreMetric }) {
  const max = Math.max(...metric.distribution, 1);
  return (
    <article className="rounded-md border border-zinc-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">{metric.label}</h3>
          <p className="mt-1 text-xs text-zinc-500">有效样本 n={metric.count}</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-semibold text-zinc-900">
            {metric.mean === null ? "—" : metric.mean.toFixed(2)}
          </p>
          <p className="text-[11px] text-zinc-500">
            中位数 {metric.median === null ? "—" : metric.median}
          </p>
        </div>
      </div>
      <div className="mt-4 grid h-20 grid-cols-5 items-end gap-2" aria-label={`${metric.label}分布`}>
        {metric.distribution.map((count, index) => (
          <div key={index} className="flex h-full flex-col justify-end gap-1">
            <span className="text-center text-[10px] tabular-nums text-zinc-500">{count}</span>
            <div
              className="min-h-1 rounded-sm bg-teal-500"
              style={{ height: `${Math.max((count / max) * 48, count ? 5 : 1)}px` }}
            />
            <span className="text-center text-[10px] text-zinc-400">{index + 1}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function ConditionComparison({ trials }: { trials: ResearchTrialRecord[] }) {
  const dimensions = [
    { instrument: "image_alignment", label: "共创图像契合度", role: "co_created", max: 7 },
    { instrument: "agency_ownership", label: "主体感", metric: "agency", max: 5 },
    { instrument: "agency_ownership", label: "作品所有权", metric: "ownership", max: 5 },
    { instrument: "csi", label: "创造支持指数", max: 100 },
    { instrument: "sus", label: "系统可用性", max: 100 },
    { instrument: "raw_tlx", label: "任务负荷", max: 100 },
  ] as const;
  const multiCount = trials.filter(
    (trial) => trial.condition === "multi_agent" && questionnaireScore(trial, "image_alignment", "co_created") !== null
  ).length;
  const singleCount = trials.filter(
    (trial) => trial.condition === "single_agent" && questionnaireScore(trial, "image_alignment", "co_created") !== null
  ).length;

  return (
    <div className="overflow-x-auto border-y border-zinc-200 bg-white">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-zinc-50 text-xs text-zinc-500">
          <tr>
            <th className="w-36 px-4 py-3 font-medium">评价维度</th>
            <th className="px-4 py-3 font-medium">音乐家共同聆听（n={multiCount}）</th>
            <th className="px-4 py-3 font-medium">单一共创引导（n={singleCount}）</th>
          </tr>
        </thead>
        <tbody>
          {dimensions.map((dimension) => {
            const summarize = (condition: ResearchCondition) => {
              if (!("metric" in dimension)) {
                return meanQuestionnaireScore(
                  trials,
                  condition,
                  dimension.instrument,
                  "role" in dimension ? dimension.role : undefined
                );
              }
              const values = trials
                .filter((trial) => trial.condition === condition)
                .map((trial) => questionnaireMetric(trial, dimension.instrument, dimension.metric))
                .filter((value): value is number => value !== null);
              return {
                mean: values.length
                  ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100
                  : null,
                count: values.length,
              };
            };
            const multi = summarize("multi_agent");
            const single = summarize("single_agent");
            return (
              <tr key={dimension.label} className="border-t border-zinc-100">
                <th className="px-4 py-4 font-semibold text-zinc-800">{dimension.label}</th>
                {[multi, single].map((result, index) => (
                  <td key={index} className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-2 flex-1 overflow-hidden rounded-sm bg-zinc-100">
                        <div
                          className={index === 0 ? "h-full bg-teal-500" : "h-full bg-blue-500"}
                          style={{ width: `${result.mean === null ? 0 : (result.mean / dimension.max) * 100}%` }}
                        />
                      </div>
                      <span className="w-10 text-right font-semibold tabular-nums text-zinc-900">
                        {result.mean === null ? "—" : result.mean.toFixed(2)}
                      </span>
                    </div>
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ArtworkLiftComparison({ trials }: { trials: ResearchTrialRecord[] }) {
  const rows = (["multi_agent", "single_agent"] as const).map((condition) => {
    const matching = trials.filter((trial) => trial.condition === condition);
    const paired = matching.flatMap((trial) => {
      const coCreated = questionnaireScore(trial, "image_alignment", "co_created");
      const baseline = questionnaireScore(trial, "image_alignment", "direct_baseline");
      return coCreated === null || baseline === null ? [] : [{ coCreated, baseline }];
    });
    const mean = (key: "coCreated" | "baseline") => paired.length
      ? paired.reduce((sum, value) => sum + value[key], 0) / paired.length
      : null;
    const coCreated = mean("coCreated");
    const baseline = mean("baseline");
    return {
      condition,
      count: paired.length,
      coCreated,
      baseline,
      lift: coCreated === null || baseline === null ? null : coCreated - baseline,
    };
  });
  return (
    <div className="overflow-x-auto border-y border-zinc-200 bg-white">
      <table className="w-full min-w-[620px] text-left text-sm">
        <thead className="bg-zinc-50 text-xs text-zinc-500">
          <tr>
            <th className="px-4 py-3 font-medium">体验条件</th>
            <th className="px-4 py-3 font-medium">有效配对</th>
            <th className="px-4 py-3 font-medium">共创作品均值</th>
            <th className="px-4 py-3 font-medium">音乐直出均值</th>
            <th className="px-4 py-3 font-medium">共创提升值</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.condition} className="border-t border-zinc-100">
              <th className="px-4 py-4 font-semibold text-zinc-800">{CONDITION_LABELS[row.condition]}</th>
              <td className="px-4 py-4 tabular-nums">{row.count}</td>
              <td className="px-4 py-4 tabular-nums">{row.coCreated?.toFixed(2) || "—"}</td>
              <td className="px-4 py-4 tabular-nums">{row.baseline?.toFixed(2) || "—"}</td>
              <td className="px-4 py-4 font-semibold tabular-nums text-teal-700">
                {row.lift === null ? "—" : `${row.lift >= 0 ? "+" : ""}${row.lift.toFixed(2)}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const classes = status === "completed"
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : status === "evaluating"
      ? "bg-blue-50 text-blue-700 ring-blue-200"
      : status === "generating"
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : "bg-zinc-100 text-zinc-600 ring-zinc-200";
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-xs ring-1 ring-inset ${classes}`}>
      {STATUS_LABELS[status] || status || "未知"}
    </span>
  );
}

function CompletenessDots({ trial }: { trial: ResearchTrialRecord }) {
  const integrated = usesIntegratedQuestionnaires(trial.protocolVersion);
  const requiredInstruments = usesStreamlinedQuestionnaires(trial.protocolVersion)
    ? ["csi", "agency_ownership", "sus", "raw_tlx", "manipulation_check"]
    : ["csi", "sus", "raw_tlx", "manipulation_check"];
  const checks = integrated
    ? [
        questionnaireScore(trial, "image_alignment", "co_created") !== null,
        requiredInstruments.every((instrument) => (
          trial.questionnaireResponses.some((response) => (
            textValue(response.instrument) === instrument && textValue(response.status) === "completed"
          ))
        )),
        questionnaireScore(trial, "image_alignment", "direct_baseline") !== null,
      ]
    : [
        Boolean(trial.artworkEvaluation),
        Boolean(trial.comparison),
        Boolean(trial.manipulationCheck),
      ];
  return (
    <div className="flex items-center gap-1" title={integrated
      ? "共创作品评价 / 体验量表 / 音乐直出作品评价"
      : "画作评价 / 作品对比 / 交互体验"}>
      {checks.map((complete, index) => (
        <span
          key={index}
          className={`h-2.5 w-2.5 rounded-full ${complete ? "bg-emerald-500" : "bg-zinc-200"}`}
        />
      ))}
    </div>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[11px] font-semibold text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

function ArtworkPreview({
  label,
  imageUrl,
  fallbackUrl,
  runId,
}: {
  label: string;
  imageUrl: string;
  fallbackUrl: string;
  runId: string;
}) {
  const thumbnailUrl = buildResearchThumbnailUrl(imageUrl);

  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-zinc-800">{label}</h4>
        <span className="truncate text-[10px] text-zinc-400">{shortId(runId)}</span>
      </div>
      <div className="aspect-video overflow-hidden rounded border border-zinc-200 bg-zinc-100">
        {imageUrl ? (
          <a
            href={imageUrl}
            target="_blank"
            rel="noreferrer"
            className="block h-full w-full"
            title="打开高清原图"
          >
            <img
              src={thumbnailUrl}
              alt={label}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-contain"
              onError={(event) => {
                const fallbackStage = event.currentTarget.dataset.fallbackStage || "thumbnail";
                if (fallbackStage === "thumbnail" && thumbnailUrl !== imageUrl) {
                  event.currentTarget.dataset.fallbackStage = "original";
                  event.currentTarget.src = imageUrl;
                } else if (fallbackStage !== "remote" && fallbackUrl && fallbackUrl !== imageUrl) {
                  event.currentTarget.dataset.fallbackStage = "remote";
                  event.currentTarget.src = fallbackUrl;
                }
              }}
            />
          </a>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-zinc-400">没有图像</div>
        )}
      </div>
    </div>
  );
}

function JsonDetails({ title, value }: { title: string; value: unknown }) {
  return (
    <details className="border-t border-zinc-200 py-3">
      <summary className="cursor-pointer text-sm font-semibold text-zinc-700">{title}</summary>
      <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded bg-zinc-950 p-3 text-[11px] leading-relaxed text-zinc-100">
        {safeStringify(value)}
      </pre>
    </details>
  );
}

function TrialDrawer({
  trial,
  currentProtocolVersion,
  onClose,
}: {
  trial: ResearchTrialRecord;
  currentProtocolVersion: string;
  onClose: () => void;
}) {
  const artwork = trial.artworkEvaluation;
  const manipulation = trial.manipulationCheck;
  const visualBrief = trial.visualBrief && typeof trial.visualBrief === "object"
    ? trial.visualBrief as Record<string, unknown>
    : null;
  const visualFields = visualBrief?.fields && typeof visualBrief.fields === "object"
    ? visualBrief.fields as Record<string, unknown>
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/25" role="presentation" onMouseDown={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`体验 ${trial.id} 详情`}
        className="ml-auto flex h-full w-[min(760px,96vw)] flex-col bg-white shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-teal-700">
              {CONDITION_LABELS[trial.condition]} · {protocolLabel(trial.protocolVersion, currentProtocolVersion)}
            </p>
            <h2 className="mt-1 truncate text-xl font-semibold text-zinc-900">{trial.musicTitle}</h2>
            <p className="mt-1 text-xs text-zinc-500">
              {shortId(trial.participantId)} · {formatDate(trial.createdAt, true)}
            </p>
            <div className="mt-2">
              <DataOriginBadges origins={trial.dataOrigins} />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-xl text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
            aria-label="关闭体验详情"
            title="关闭"
          >
            ×
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {trial.issues.length > 0 && (
            <section className="mb-6 border-l-4 border-amber-400 bg-amber-50 px-4 py-3">
              <h3 className="text-sm font-semibold text-amber-900">数据检查</h3>
              <ul className="mt-2 space-y-1 text-xs text-amber-800">
                {trial.issues.map((item) => <li key={item.id}>{item.label}</li>)}
              </ul>
            </section>
          )}

          <section className="mb-7">
            <SectionTitle title="记录元数据" />
            <dl className="grid gap-x-5 gap-y-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-zinc-500">体验 ID</dt>
                <dd className="mt-1 break-all font-mono text-xs text-zinc-800">{trial.id}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Session ID</dt>
                <dd className="mt-1 break-all font-mono text-xs text-zinc-800">{trial.sessionId}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">数据来源</dt>
                <dd className="mt-1"><DataOriginBadges origins={trial.dataOrigins} /></dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-zinc-500">Participant ID</dt>
                <dd className="mt-1 break-all font-mono text-xs text-zinc-800">{trial.participantId}</dd>
              </div>
            </dl>
          </section>

          <section className="mb-7">
            <SectionTitle title="配对作品" description="共创与音乐直出使用同一份 MusicProfile。" />
            <div className="grid gap-4 sm:grid-cols-2">
              <ArtworkPreview
                label="共创作品"
                imageUrl={trial.coCreatedRun?.imageUrl || ""}
                fallbackUrl={trial.coCreatedRun?.remoteImageUrl || ""}
                runId={trial.coCreatedRun?.id || ""}
              />
              <ArtworkPreview
                label="音乐直出作品"
                imageUrl={trial.baselineRun?.imageUrl || ""}
                fallbackUrl={trial.baselineRun?.remoteImageUrl || ""}
                runId={trial.baselineRun?.id || ""}
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-4 text-xs text-zinc-500">
              <p>共创耗时：{formatDuration(trial.coCreatedRun?.totalMs)}</p>
              <p>音乐直出耗时：{formatDuration(trial.baselineRun?.totalMs)}</p>
            </div>
          </section>

          <section className="mb-7">
            <SectionTitle title="问卷结果" />
            {trial.questionnaireResponses.length > 0 && (
              <div className="mb-5 grid gap-3 sm:grid-cols-2">
                {trial.questionnaireResponses.map((response, index) => (
                  <article key={String(response.id || index)} className="rounded border border-zinc-200 bg-zinc-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-zinc-800">{String(response.instrument || "问卷")}</p>
                        <p className="mt-1 font-mono text-[10px] text-zinc-500">{String(response.questionnaire_version || "未记录版本")}</p>
                      </div>
                      <span className="text-xs font-semibold text-teal-700">
                        {response.score_total === null || response.score_total === undefined
                          ? "无总分"
                          : `总分 ${String(response.score_total)}`}
                      </span>
                    </div>
                    <details className="mt-3 border-t border-zinc-200 pt-2">
                      <summary className="cursor-pointer text-xs font-medium text-zinc-600">查看原始回答与子维度</summary>
                      <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap break-all rounded bg-zinc-950 p-2 text-[10px] text-zinc-100">
                        {safeStringify({ answers: response.answers, metrics: response.metrics })}
                      </pre>
                    </details>
                  </article>
                ))}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead className="border-b border-zinc-200 text-zinc-500">
                  <tr>
                    <th className="py-2 font-medium">音乐匹配</th>
                    <th className="py-2 font-medium">想象匹配</th>
                    <th className="py-2 font-medium">主体感</th>
                    <th className="py-2 font-medium">所有权</th>
                    <th className="py-2 font-medium">沉浸感</th>
                    <th className="py-2 font-medium">满意度</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="font-semibold text-zinc-900">
                    {[
                      "music_match_score",
                      "imagination_match_score",
                      "agency_score",
                      "ownership_score",
                      "immersion_score",
                      "satisfaction_score",
                    ].map((key) => <td key={key} className="py-3">{scoreValue(artwork, key)}</td>)}
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-4 grid gap-3 border-t border-zinc-200 pt-4 text-sm sm:grid-cols-3">
              <p><span className="block text-xs text-zinc-500">音乐匹配选择</span>{choiceLabel(trial.comparison?.musicMatchChoice)}</p>
              <p><span className="block text-xs text-zinc-500">想象／审美选择</span>{choiceLabel(trial.comparison?.imaginationMatchChoice)}</p>
              <p><span className="block text-xs text-zinc-500">总体选择</span>{choiceLabel(trial.comparison?.overallChoice)}</p>
            </div>
            {trial.comparison?.reason && (
              <p className="mt-3 border-l-2 border-zinc-300 pl-3 text-sm leading-relaxed text-zinc-700">
                {trial.comparison.reason}
              </p>
            )}
            <div className="mt-4 grid gap-3 border-t border-zinc-200 pt-4 text-sm sm:grid-cols-3">
              <p><span className="block text-xs text-zinc-500">多视角感</span>{scoreValue(manipulation, "perspective_multiplicity_score")}</p>
              <p><span className="block text-xs text-zinc-500">表达支持</span>{scoreValue(manipulation, "articulation_support_score")}</p>
              <p><span className="block text-xs text-zinc-500">对话体验</span>{scoreValue(manipulation, "dialogue_experience_score")}</p>
            </div>
          </section>

          <section className="mb-7">
            <SectionTitle
              title="对话记录"
              description={`${trial.conversationMessages.length} 条消息；用户原始文本仅在此处展示。`}
            />
            {trial.conversationMessages.length ? (
              <ol className="space-y-3">
                {trial.conversationMessages.map((message, index) => (
                  <li key={String(message.id || index)} className="grid grid-cols-[90px_1fr] gap-3 border-b border-zinc-100 pb-3">
                    <div>
                      <p className="text-xs font-semibold text-zinc-700">{String(message.speakerId || message.role || "未知")}</p>
                      <p className="mt-1 text-[10px] text-zinc-400">#{String(message.sequence || index + 1)}</p>
                    </div>
                    <p className="text-sm leading-relaxed text-zinc-700">{String(message.content || "")}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-zinc-400">没有保存的对话快照。</p>
            )}
          </section>

          {visualFields && (
            <section className="mb-7">
              <SectionTitle title="VisualBrief" description={`共 ${trial.visualBriefVersions.length} 个版本`} />
              <dl className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
                {Object.entries(visualFields).map(([key, value]) => {
                  const field = value && typeof value === "object" ? value as Record<string, unknown> : null;
                  return (
                    <div key={key} className="border-b border-zinc-100 pb-3">
                      <dt className="text-xs font-semibold text-zinc-500">{key}</dt>
                      <dd className="mt-1 text-sm leading-relaxed text-zinc-800">
                        {field ? safeStringify(field.value) : safeStringify(value)}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </section>
          )}

          <section className="mb-7">
            <SectionTitle title="生成提示词与配置" />
            <div className="space-y-4">
              {[
                ["共创 Prompt", trial.coCreatedRun],
                ["音乐直出 Prompt", trial.baselineRun],
              ].map(([label, run]) => {
                const typedRun = run as ResearchTrialRecord["coCreatedRun"];
                return (
                  <div key={String(label)} className="border-l-2 border-teal-400 pl-3">
                    <h4 className="text-xs font-semibold text-zinc-500">{String(label)}</h4>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">
                      {typedRun?.prompt || "未记录"}
                    </p>
                    <p className="mt-2 text-xs text-zinc-500">
                      {typedRun?.imageModel || "未记录模型"} · {typedRun?.imageSize || "未记录尺寸"}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mb-7">
            <SectionTitle title="交互事件" description={`${trial.interactionEvents.length} 条`} />
            <ol className="space-y-2 border-l border-zinc-200 pl-4">
              {trial.interactionEvents.map((event, index) => (
                <li key={String(event.id || index)} className="relative grid gap-1 py-1 sm:grid-cols-[130px_1fr]">
                  <span className="absolute -left-[19px] top-3 h-2 w-2 rounded-full bg-zinc-400" />
                  <time className="text-xs text-zinc-400">{formatDate(textValue(event.created_at), true)}</time>
                  <div>
                    <p className="text-sm font-medium text-zinc-700">{textValue(event.event_type) || "未知事件"}</p>
                    <p className="text-xs text-zinc-400">{textValue(event.page)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <JsonDetails title="MusicProfile 原始数据" value={trial.musicProfile} />
          <JsonDetails title="ConversationState 原始数据" value={trial.conversationState} />
          <JsonDetails title="VisualBrief 原始数据" value={trial.visualBrief} />
          <JsonDetails title="生成记录与耗时" value={{
            coCreated: trial.coCreatedRun?.raw,
            baseline: trial.baselineRun?.raw,
            baselineJob: trial.baselineJob,
          }} />
        </div>
      </aside>
    </div>
  );
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function OverviewView({
  trials,
  allTrials,
  studySessions,
  currentProtocolVersion,
}: {
  trials: ResearchTrialRecord[];
  allTrials: ResearchTrialRecord[];
  studySessions: ResearchStudySessionRecord[];
  currentProtocolVersion: string;
}) {
  const summary = useMemo(() => summarizeResearchTrials(trials), [trials]);
  const currentVersionTrials = allTrials.filter(
    (trial) => trial.protocolVersion === currentProtocolVersion
  );
  const analyzableTrials = currentVersionTrials.filter(
    (trial) => trial.questionnaireComplete
  );
  const historicalTrials = allTrials.filter(
    (trial) => trial.protocolVersion !== currentProtocolVersion
  );
  const incompleteTrials = allTrials.filter(
    (trial) => trial.status !== "completed" || !trial.questionnaireComplete
  );
  const errorTrials = allTrials.filter(
    (trial) => trial.issues.some((item) => item.severity === "error")
  );
  const completedSessions = studySessions.filter((session) => session.complete);
  const sessionIssues = studySessions.filter((session) =>
    session.issues.some((item) => item.severity === "error")
  );

  return (
    <div className="space-y-10">
      <section>
        <SectionTitle
          title="数据收集进度"
          description={`当前共有 ${allTrials.length} 次体验，其中 ${currentVersionTrials.length} 次属于最新实验版本，${analyzableTrials.length} 次完成全部问卷。`}
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <SummaryCard label="全部体验" value={String(allTrials.length)} detail="当前数据源内的总记录" tone="zinc" />
          <SummaryCard label="最新版本" value={String(currentVersionTrials.length)} detail="可用于当前实验设计" tone="teal" />
          <SummaryCard label="可分析样本" value={String(analyzableTrials.length)} detail="已完成全部问卷" tone="blue" />
          <SummaryCard label="尚未完成" value={String(incompleteTrials.length)} detail="流程或问卷未结束" tone="amber" />
          <SummaryCard label="历史版本" value={String(historicalTrials.length)} detail="可按实验版本单独筛选" tone="zinc" />
          <SummaryCard label="需要检查" value={String(errorTrials.length)} detail="存在生成或记录异常" tone="rose" />
        </div>
        <div className="mt-4 border-l-4 border-blue-500 bg-blue-50 px-4 py-3 text-sm leading-relaxed text-blue-900">
          下方趋势基于当前筛选得到的 <strong>{summary.totalTrials}</strong> 次体验。
          若当前包含多个实验版本，这些统计只用于数据盘点；正式分析时请筛选单一实验版本。
        </div>
      </section>

      {studySessions.length > 0 && (
        <section>
          <SectionTitle
            title="组内配对实验进度"
            description="一行代表一位参与者；两次体验必须都完成，才会进入配对分析。"
          />
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <SummaryCard label="参与者" value={String(studySessions.length)} detail="已创建双体验会话" tone="zinc" />
            <SummaryCard label="完整配对" value={String(completedSessions.length)} detail="两次体验与最终比较均完成" tone="teal" />
            <SummaryCard label="需要检查" value={String(sessionIssues.length)} detail="存在缺失周期或比较记录" tone="rose" />
          </div>
          <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
            <table className="w-full min-w-[1060px] text-left text-xs">
              <thead className="bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-3 py-3 font-medium">来源</th>
                  <th className="px-3 py-3 font-medium">参与者</th>
                  <th className="px-3 py-3 font-medium">分配序列</th>
                  <th className="px-3 py-3 font-medium">体验 1</th>
                  <th className="px-3 py-3 font-medium">体验 2</th>
                  <th className="px-3 py-3 font-medium">最终偏好</th>
                  <th className="px-3 py-3 font-medium">状态</th>
                </tr>
              </thead>
              <tbody>
                {studySessions.map((session) => (
                  <tr key={session.id} className="border-t border-zinc-100 text-zinc-700">
                    <td className="px-3 py-3">
                      <DataOriginBadges origins={session.dataOrigins} />
                    </td>
                    <td className="px-3 py-3 font-mono text-[11px]" title={session.participantId}>
                      {shortId(session.participantId)}
                    </td>
                    <td className="px-3 py-3">{sequenceLabel(session.sequence)}</td>
                    {[session.firstTrial, session.secondTrial].map((trial, index) => (
                      <td key={index} className="px-3 py-3">
                        {trial ? (
                          <>
                            <p className="font-semibold text-zinc-900">{CONDITION_LABELS[trial.condition]}</p>
                            <p className="mt-1 max-w-48 truncate text-[10px] text-zinc-500" title={trial.musicTitle}>
                              {trial.musicTitle}
                            </p>
                            <p className={`mt-1 text-[10px] ${trial.questionnaireComplete ? "text-emerald-700" : "text-amber-700"}`}>
                              {trial.questionnaireComplete ? "评价完整" : "评价未完成"}
                            </p>
                          </>
                        ) : (
                          <span className="text-zinc-400">尚未开始</span>
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-3">
                      {sessionChoiceLabel(sessionPreferenceChoice(session))}
                    </td>
                    <td className="px-3 py-3">
                      <span className={session.complete ? "text-emerald-700" : "text-amber-700"}>
                        {STUDY_SESSION_STATUS_LABELS[session.status] || session.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <SectionTitle
          title="两种体验路径带来了什么差异？"
          description="以下为两组用户的量表均值：图像契合度为 1–7 分，CSI、SUS 与任务负荷为 0–100 分。"
        />
        <ConditionComparison trials={trials} />
      </section>

      <section className="grid gap-8 xl:grid-cols-[1.05fr_1fr]">
        <div>
          <SectionTitle
            title="共创是否带来了更匹配的作品？"
            description="基于同一路径两张作品的图像契合度均值；提升值 = 共创作品 − 音乐直出作品。"
          />
          <ArtworkLiftComparison trials={trials} />
        </div>
        <div>
          <SectionTitle title="当前筛选样本是否完整？" description="用于判断这些结果能否进入后续分析。" />
          <div className="grid grid-cols-2 gap-3">
            <SummaryCard label="问卷完整" value={`${summary.questionnaireCompleteTrials}/${summary.totalTrials}`} detail={`${summary.questionnaireRate}% 完整`} tone="blue" />
            <SummaryCard label="配对作品完整" value={`${summary.generationCompleteTrials}/${summary.totalTrials}`} detail={`${summary.generationRate}% 完整`} tone="amber" />
            <SummaryCard label="流程已完成" value={`${summary.completedTrials}/${summary.totalTrials}`} detail={`${summary.completionRate}% 完成`} tone="teal" />
            <SummaryCard label="音乐直出成功" value={`${summary.baselineCompleteTrials}/${summary.totalTrials}`} detail={`${summary.baselineRate}% 成功`} tone="rose" />
          </div>
        </div>
      </section>

      <details className="rounded-md border border-zinc-200 bg-white">
        <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-zinc-800">
          查看完整量表分布
        </summary>
        <div className="border-t border-zinc-200 p-5">
          <SectionTitle title="历史结果页评价" description="仅用于追溯旧协议的 1–5 分题目；V2-18 不采集这些字段。" />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {summary.artworkScores.map((metric) => <ScoreDistribution key={metric.key} metric={metric} />)}
          </div>
          <div className="mt-8">
            <SectionTitle title="交互体验检查" description="确认两种路径是否带来了预期的体验差异。" />
            <div className="grid gap-3 md:grid-cols-3">
              {summary.manipulationScores.map((metric) => <ScoreDistribution key={metric.key} metric={metric} />)}
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}

function TrialsView({
  trials,
  onSelect,
}: {
  trials: ResearchTrialRecord[];
  onSelect: (trial: ResearchTrialRecord) => void;
}) {
  return (
    <section>
      <SectionTitle
        title="实验记录"
        description={`当前显示 ${trials.length} 次体验，点击“查看”追溯完整实验链路。`}
      />
      <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
        <table className="w-full min-w-[1200px] text-left text-xs">
          <thead className="bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-3 py-3 font-medium">来源</th>
              <th className="px-3 py-3 font-medium">时间</th>
              <th className="px-3 py-3 font-medium">参与者</th>
              <th className="px-3 py-3 font-medium">条件</th>
              <th className="px-3 py-3 font-medium">音乐</th>
              <th className="px-3 py-3 font-medium">状态</th>
              <th className="px-3 py-3 font-medium">问卷</th>
              <th className="px-3 py-3 font-medium">作品</th>
              <th className="px-3 py-3 font-medium">生成耗时</th>
              <th className="px-3 py-3 font-medium">检查</th>
              <th className="px-3 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {trials.map((trial) => (
              <tr key={trial.id} className="border-t border-zinc-100 text-zinc-700 hover:bg-zinc-50">
                <td className="px-3 py-3"><DataOriginBadges origins={trial.dataOrigins} /></td>
                <td className="whitespace-nowrap px-3 py-3">{formatDate(trial.createdAt)}</td>
                <td className="px-3 py-3 font-mono text-[11px]" title={trial.participantId}>{shortId(trial.participantId)}</td>
                <td className="px-3 py-3 font-semibold">{CONDITION_LABELS[trial.condition]}</td>
                <td className="max-w-48 px-3 py-3">
                  <p className="truncate font-medium text-zinc-900" title={trial.musicTitle}>{trial.musicTitle}</p>
                  <p className="mt-1 text-[10px] text-zinc-400">{trial.audioSourceKind || "未知来源"} · {trial.analysisMode || "未知分析"}</p>
                </td>
                <td className="px-3 py-3"><StatusBadge status={trial.status} /></td>
                <td className="px-3 py-3"><CompletenessDots trial={trial} /></td>
                <td className="px-3 py-3">
                  <span className={trial.generationComplete ? "text-emerald-700" : "text-amber-700"}>
                    {[trial.coCreatedRun, trial.baselineRun].filter(Boolean).length}/2
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-3">
                  <span title="共创">{formatDuration(trial.coCreatedRun?.totalMs)}</span>
                  <span className="mx-1 text-zinc-300">/</span>
                  <span title="音乐直出">{formatDuration(trial.baselineRun?.totalMs)}</span>
                </td>
                <td className="px-3 py-3">
                  {trial.issues.length ? (
                    <span className="inline-flex rounded-full bg-amber-50 px-2 py-1 text-amber-700 ring-1 ring-inset ring-amber-200">
                      {trial.issues.length} 项
                    </span>
                  ) : (
                    <span className="text-emerald-700">正常</span>
                  )}
                </td>
                <td className="px-3 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => onSelect(trial)}
                    className="rounded border border-zinc-300 px-3 py-1.5 font-medium text-zinc-700 hover:border-teal-500 hover:text-teal-700"
                  >
                    查看
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {trials.length === 0 && (
          <div className="py-16 text-center text-sm text-zinc-400">当前筛选条件下没有实验记录。</div>
        )}
      </div>
    </section>
  );
}

function collectQuestionnaireRows(
  trials: ResearchTrialRecord[],
  studySessions: ResearchStudySessionRecord[]
): QuestionnaireRow[] {
  const trialMap = new Map(trials.map((trial) => [trial.id, trial]));
  const rows = new Map<string, QuestionnaireRow>();
  const addResponse = (
    response: Record<string, unknown>,
    fallbackTrial: ResearchTrialRecord | null,
    fallbackSession: ResearchStudySessionRecord | null
  ) => {
    const trialId = textValue(response.trial_id) || fallbackTrial?.id || "";
    const trial = trialMap.get(trialId) || fallbackTrial;
    const id = textValue(response.id)
      || `${textValue(response.study_session_id)}:${textValue(response.response_key)}`;
    if (rows.has(id)) return;
    const score = Number(response.score_total);
    rows.set(id, {
      id,
      participantId: textValue(response.participant_id)
        || trial?.participantId
        || fallbackSession?.participantId
        || "",
      studySessionId: textValue(response.study_session_id)
        || trial?.studySessionId
        || fallbackSession?.id
        || "",
      trialId,
      period: Number(response.period) === 1 || Number(response.period) === 2
        ? Number(response.period)
        : trial?.period || null,
      condition: textValue(response.condition) === "multi_agent"
        ? "multi_agent"
        : textValue(response.condition) === "single_agent"
          ? "single_agent"
          : trial?.condition || "unknown",
      instrument: textValue(response.instrument),
      generationRole: textValue(response.generation_role),
      status: textValue(response.status),
      totalScore: Number.isFinite(score) ? score : null,
      questionnaireVersion: textValue(response.questionnaire_version),
      completedAt: textValue(response.completed_at) || textValue(response.updated_at),
      answers: response.answers || {},
      metrics: response.metrics || {},
      trial,
    });
  };

  for (const trial of trials) {
    for (const response of trial.questionnaireResponses) addResponse(response, trial, null);
  }
  for (const session of studySessions) {
    for (const response of session.questionnaireResponses) addResponse(response, null, session);
  }
  return [...rows.values()].sort((left, right) => (
    Date.parse(right.completedAt) - Date.parse(left.completedAt)
  ));
}

function QuestionnairesView({
  trials,
  studySessions,
  onSelect,
}: {
  trials: ResearchTrialRecord[];
  studySessions: ResearchStudySessionRecord[];
  onSelect: (trial: ResearchTrialRecord) => void;
}) {
  const rows = useMemo(
    () => collectQuestionnaireRows(trials, studySessions),
    [studySessions, trials]
  );
  const completed = rows.filter((row) => row.status === "completed").length;
  const participantCount = new Set(rows.map((row) => row.participantId).filter(Boolean)).size;
  const instrumentCount = new Set(rows.map((row) => row.instrument).filter(Boolean)).size;

  return (
    <div className="space-y-8">
      <section>
        <SectionTitle
          title="问卷回收情况"
          description="当前正式实验每位参与者应完成 17 个问卷模块；这里显示原始回收记录及其与体验、作品的关联。"
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="问卷记录" value={String(rows.length)} detail="包含草稿与已完成模块" tone="zinc" />
          <SummaryCard label="已完成模块" value={String(completed)} detail="已通过完整性校验" tone="teal" />
          <SummaryCard label="涉及参与者" value={String(participantCount)} detail="按实验者编号去重" tone="blue" />
          <SummaryCard label="量表类型" value={String(instrumentCount)} detail="当前数据中已出现的类型" tone="amber" />
        </div>
        {rows.length === 0 && (
          <div className="mt-4 border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            当前数据库还没有正式问卷回答。新版表头和导出能力已经启用；从正式实验入口创建的新会话完成问卷后，记录会自动出现在这里。历史协议数据不会被伪装成当前问卷。
          </div>
        )}
      </section>

      <section>
        <SectionTitle
          title="问卷记录明细"
          description="一行代表一个问卷模块；展开可查看该模块的原始答案与子维度。"
        />
        <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
          <table className="w-full min-w-[1420px] text-left text-xs">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-3 py-3 font-medium">参与者编号</th>
                <th className="px-3 py-3 font-medium">体验轮次</th>
                <th className="px-3 py-3 font-medium">体验条件</th>
                <th className="px-3 py-3 font-medium">问卷／量表</th>
                <th className="px-3 py-3 font-medium">评价对象</th>
                <th className="px-3 py-3 font-medium">总分／均值</th>
                <th className="px-3 py-3 font-medium">状态</th>
                <th className="px-3 py-3 font-medium">版本</th>
                <th className="px-3 py-3 font-medium">提交时间</th>
                <th className="px-3 py-3 font-medium">原始回答</th>
                <th className="px-3 py-3 text-right font-medium">关联记录</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-zinc-100 align-top text-zinc-700">
                  <td className="px-3 py-3 font-mono" title={row.participantId}>{shortId(row.participantId)}</td>
                  <td className="px-3 py-3">{row.period ? `体验 ${row.period}` : "全程"}</td>
                  <td className="px-3 py-3">{row.condition === "unknown" ? "跨体验" : CONDITION_LABELS[row.condition]}</td>
                  <td className="px-3 py-3 font-medium text-zinc-900">{QUESTIONNAIRE_LABELS[row.instrument] || row.instrument || "未记录"}</td>
                  <td className="px-3 py-3">{GENERATION_ROLE_LABELS[row.generationRole] || "交互体验"}</td>
                  <td className="px-3 py-3 font-semibold tabular-nums text-teal-700">{row.totalScore === null ? "不计算" : row.totalScore}</td>
                  <td className="px-3 py-3">{row.status === "completed" ? "已完成" : "草稿"}</td>
                  <td className="px-3 py-3 font-mono text-[10px]">{row.questionnaireVersion || "未记录"}</td>
                  <td className="px-3 py-3">{formatDate(row.completedAt, true)}</td>
                  <td className="px-3 py-3">
                    <details>
                      <summary className="cursor-pointer font-medium text-teal-700">查看回答</summary>
                      <pre className="mt-2 max-h-48 w-80 overflow-auto whitespace-pre-wrap rounded bg-zinc-950 p-2 text-[10px] text-zinc-100">{safeStringify({ answers: row.answers, metrics: row.metrics })}</pre>
                    </details>
                  </td>
                  <td className="px-3 py-3 text-right">
                    {row.trial ? (
                      <button
                        type="button"
                        onClick={() => onSelect(row.trial!)}
                        className="rounded border border-zinc-300 px-3 py-1.5 font-medium hover:border-teal-500 hover:text-teal-700"
                      >
                        查看体验
                      </button>
                    ) : (
                      <span className="text-zinc-400">会话级</span>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr className="border-t border-zinc-100">
                  <td colSpan={11} className="px-4 py-16 text-center text-sm text-zinc-400">
                    当前筛选条件下暂无问卷记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function QualityView({
  trials,
  studySessions,
  onSelect,
}: {
  trials: ResearchTrialRecord[];
  studySessions: ResearchStudySessionRecord[];
  onSelect: (trial: ResearchTrialRecord) => void;
}) {
  const allIssues = trials.flatMap((trial) => trial.issues);
  const historicalIssues = allIssues.filter((item) => item.code === "legacy_protocol");
  const issues = allIssues.filter((item) => item.code !== "legacy_protocol");
  const historicalTrialCount = new Set(historicalIssues.map((item) => item.trialId)).size;
  const grouped = [...issues.reduce((map, item) => {
    const current = map.get(item.code) || { label: item.label.split("：")[0], count: 0, severity: item.severity };
    current.count += 1;
    map.set(item.code, current);
    return map;
  }, new Map<string, { label: string; count: number; severity: ResearchDataIssue["severity"] }>())];
  const trialMap = new Map(trials.map((trial) => [trial.id, trial]));

  return (
    <div className="space-y-8">
      <section>
        <SectionTitle title="数据检查" description="区分真正的数据异常与不可直接合并的历史实验记录。" />
        {historicalTrialCount > 0 && (
          <div className="mb-4 border-l-4 border-blue-400 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            当前范围内有 <strong>{historicalTrialCount}</strong> 次体验来自历史实验版本。
            这些记录仍可查看；正式分析时请通过“实验版本”筛选，避免混合不同协议的数据。
          </div>
        )}
        {grouped.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {grouped.map(([code, item]) => (
              <article key={code} className={`rounded-md border p-4 ${item.severity === "error" ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-amber-50"}`}>
                <p className="text-xs font-semibold text-zinc-600">{item.label}</p>
                <p className="mt-2 text-3xl font-semibold text-zinc-900">{item.count}</p>
                <p className="mt-1 font-mono text-[10px] text-zinc-400">{code}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="border-l-4 border-emerald-500 bg-emerald-50 px-4 py-5 text-sm text-emerald-800">
            当前筛选范围内没有发现数据完整性问题。
          </div>
        )}
      </section>

      {studySessions.some((session) => session.issues.length > 0) && (
        <section>
          <SectionTitle
            title="配对实验异常"
            description="参与者级问题，例如缺少其中一次体验或缺少最终体验对比。"
          />
          <div className="overflow-x-auto border-y border-zinc-200 bg-white">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-zinc-50 text-xs text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">来源</th>
                  <th className="px-4 py-3 font-medium">参与者</th>
                  <th className="px-4 py-3 font-medium">实验状态</th>
                  <th className="px-4 py-3 font-medium">问题</th>
                </tr>
              </thead>
              <tbody>
                {studySessions
                  .filter((session) => session.issues.length > 0)
                  .map((session) => (
                    <tr key={session.id} className="border-t border-zinc-100">
                      <td className="px-4 py-3">
                        <DataOriginBadges origins={session.dataOrigins} />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-600">
                        {shortId(session.participantId)}
                      </td>
                      <td className="px-4 py-3 text-zinc-700">{session.status}</td>
                      <td className="px-4 py-3 text-rose-700">
                        {session.issues.map((item) => item.label).join("；")}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <SectionTitle title="异常记录" description={`${issues.length} 个真实异常，可按单次体验追溯。`} />
        <div className="overflow-x-auto border-y border-zinc-200 bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">来源</th>
                <th className="px-4 py-3 font-medium">级别</th>
                <th className="px-4 py-3 font-medium">问题</th>
                <th className="px-4 py-3 font-medium">体验 ID</th>
                <th className="px-4 py-3 font-medium">体验路径</th>
                <th className="px-4 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((item) => {
                const trial = trialMap.get(item.trialId);
                return (
                  <tr key={item.id} className="border-t border-zinc-100">
                    <td className="px-4 py-3">
                      {trial && <DataOriginBadges origins={trial.dataOrigins} />}
                    </td>
                    <td className="px-4 py-3">
                      <span className={item.severity === "error" ? "text-rose-700" : "text-amber-700"}>
                        {item.severity === "error" ? "错误" : "提醒"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-800">{item.label}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">{shortId(item.trialId)}</td>
                    <td className="px-4 py-3 text-zinc-600">{trial ? CONDITION_LABELS[trial.condition] : "未知"}</td>
                    <td className="px-4 py-3 text-right">
                      {trial && (
                        <button
                          type="button"
                          onClick={() => onSelect(trial)}
                          className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:border-teal-500 hover:text-teal-700"
                        >
                          查看
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function ResearchDashboardClient({
  initialData,
  remoteSyncEnabled,
}: {
  initialData: ResearchDashboardDataset;
  remoteSyncEnabled: boolean;
}) {
  const [localDataset, setLocalDataset] = useState(initialData);
  const [remoteDataset, setRemoteDataset] = useState<ResearchDashboardDataset | null>(null);
  const [snapshotDataset, setSnapshotDataset] = useState<ResearchDashboardDataset | null>(null);
  const dataset = useMemo(
    () => mergeResearchDashboardDatasets(
      [localDataset, remoteDataset, snapshotDataset].filter(
        (item): item is ResearchDashboardDataset => item !== null
      )
    ),
    [localDataset, remoteDataset, snapshotDataset]
  );
  const [view, setView] = useState<View>("overview");
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [selectedTrial, setSelectedTrial] = useState<ResearchTrialRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoSyncAttemptedRef = useRef(false);

  const filteredTrials = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    return dataset.trials.filter((trial) => {
      if (
        filters.origin === "local" &&
        !trial.dataOrigins.includes("local")
      ) return false;
      if (
        filters.origin === "online" &&
        !trial.dataOrigins.some((origin) => origin === "online" || origin === "online_cache")
      ) return false;
      if (
        filters.origin === "snapshot" &&
        !trial.dataOrigins.includes("snapshot")
      ) return false;
      if (filters.condition !== "all" && trial.condition !== filters.condition) return false;
      if (filters.protocol !== "all" && trial.protocolVersion !== filters.protocol) return false;
      if (filters.status !== "all" && trial.status !== filters.status) return false;
      if (filters.questionnaire === "complete" && !trial.questionnaireComplete) return false;
      if (filters.questionnaire === "incomplete" && trial.questionnaireComplete) return false;
      if (filters.issue === "with-issues" && trial.issues.length === 0) return false;
      if (filters.issue === "without-issues" && trial.issues.length > 0) return false;
      const date = localDateValue(trial.createdAt);
      if (filters.from && date < filters.from) return false;
      if (filters.to && date > filters.to) return false;
      if (query && ![
        trial.id,
        trial.participantId,
        trial.sessionId,
        trial.musicTitle,
        trial.audioFileName,
      ].some((value) => value.toLowerCase().includes(query))) return false;
      return true;
    });
  }, [dataset.trials, filters]);
  const filteredTrialIds = useMemo(
    () => new Set(filteredTrials.map((trial) => trial.id)),
    [filteredTrials]
  );
  const filteredStudySessions = useMemo(
    () => dataset.studySessions.filter((session) =>
      [session.firstTrial, session.secondTrial].some(
        (trial) => trial && filteredTrialIds.has(trial.id)
      )
    ),
    [dataset.studySessions, filteredTrialIds]
  );
  const originCounts = useMemo(() => ({
    local: dataset.trials.filter((trial) => trial.dataOrigins.includes("local")).length,
    online: dataset.trials.filter((trial) =>
      trial.dataOrigins.some((origin) => origin === "online" || origin === "online_cache")
    ).length,
    snapshot: dataset.trials.filter((trial) => trial.dataOrigins.includes("snapshot")).length,
  }), [dataset.trials]);

  const refreshDatabase = async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/research/data", { cache: "no-store" });
      if (!response.ok) throw new Error("无法读取本地研究数据库");
      setLocalDataset(await response.json() as ResearchDashboardDataset);
      setSelectedTrial(null);
      setMessage("已刷新本地数据库，其他来源保持不变");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "刷新失败");
    } finally {
      setLoading(false);
    }
  };

  const syncRemoteData = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/research/remote", { cache: "no-store" });
      const result = await response.json() as {
        dataset?: ResearchDashboardDataset;
        transport?: "live" | "cache";
        warning?: string;
        error?: string;
      };
      if (!response.ok || !result.dataset) {
        throw new Error(result.error || "无法同步线上研究数据");
      }
      setRemoteDataset(result.dataset);
      setSelectedTrial(null);
      const sourceMessage = result.transport === "cache"
        ? `线上实时同步暂时不可用，已合并线上缓存（截止 ${formatDate(result.dataset.source.capturedAt, true)}）`
        : `线上数据已同步并与本地合并（${result.dataset.trials.length} 次体验）`;
      setMessage(sourceMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "线上同步失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!remoteSyncEnabled || autoSyncAttemptedRef.current) return;
    autoSyncAttemptedRef.current = true;
    void syncRemoteData();
  }, [remoteSyncEnabled, syncRemoteData]);

  const importSnapshot = async (file: File) => {
    setLoading(true);
    setMessage("");
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const next = buildResearchDashboardDataset(parsed, "snapshot");
      setSnapshotDataset(next);
      setSelectedTrial(null);
      setMessage(`已合并快照：${file.name}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "无法读取快照");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void importSnapshot(file);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void importSnapshot(file);
  };

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const exportCsv = () => {
    const hasPairedSessions = filteredStudySessions.length > 0;
    downloadText(
      hasPairedSessions
        ? exportResearchStudySessionsCsv(filteredStudySessions)
        : exportResearchTrialsCsv(filteredTrials),
      `melodyvision-${hasPairedSessions ? "participants" : "trials"}-${dataset.source.capturedAt.slice(0, 10)}.csv`,
      "text/csv;charset=utf-8"
    );
  };

  const exportQuestionnaireWorkbook = async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/research/questionnaires", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataset: {
            source: { capturedAt: dataset.source.capturedAt },
            trials: filteredTrials.map((trial) => ({
              id: trial.id,
              dataOrigins: trial.dataOrigins,
              participantId: trial.participantId,
              studySessionId: trial.studySessionId,
              period: trial.period,
              condition: trial.condition,
              protocolVersion: trial.protocolVersion,
              status: trial.status,
              stimulusId: trial.stimulusId,
              musicTitle: trial.musicTitle,
              questionnaireResponses: trial.questionnaireResponses,
              artworkEvaluation: trial.artworkEvaluation,
              comparison: trial.comparison,
            })),
            studySessions: filteredStudySessions.map((session) => ({
              id: session.id,
              dataOrigins: session.dataOrigins,
              participantId: session.participantId,
              protocolVersion: session.protocolVersion,
              sequence: session.sequence,
              status: session.status,
              complete: session.complete,
              firstSelectedAudio: session.firstSelectedAudio,
              secondSelectedAudio: session.secondSelectedAudio,
              firstTrial: session.firstTrial ? {
                id: session.firstTrial.id,
                condition: session.firstTrial.condition,
                musicTitle: session.firstTrial.musicTitle,
                stimulusId: session.firstTrial.stimulusId,
              } : null,
              secondTrial: session.secondTrial ? {
                id: session.secondTrial.id,
                condition: session.secondTrial.condition,
                musicTitle: session.secondTrial.musicTitle,
                stimulusId: session.secondTrial.stimulusId,
              } : null,
              questionnaireResponses: session.questionnaireResponses,
            })),
          },
          trialIds: filteredTrials.map((trial) => trial.id),
          studySessionIds: filteredStudySessions.map((session) => session.id),
        }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(result.error || "无法生成问卷 Excel");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `melodyvision-questionnaires-${dataset.source.capturedAt.slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage(`已导出 ${filteredStudySessions.length} 条实验会话的问卷工作簿`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "问卷导出失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f4f5f6] text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase text-teal-700">MelodyVision Research</p>
            <h1 className="mt-1 text-2xl font-semibold">实验数据后台</h1>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {remoteSyncEnabled && (
              <button
                type="button"
                onClick={() => void syncRemoteData()}
                disabled={loading}
                className="rounded bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {loading ? "同步中…" : "同步线上数据"}
              </button>
            )}
            <button
              type="button"
              onClick={() => void refreshDatabase()}
              disabled={loading}
              className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:border-teal-500 hover:text-teal-700 disabled:opacity-50"
            >
              刷新本地数据
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:border-teal-500 hover:text-teal-700 disabled:opacity-50"
            >
              导入服务器快照
            </button>
            <button
              type="button"
              onClick={exportCsv}
              className="rounded bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700"
            >
              {filteredStudySessions.length > 0 ? "导出实验过程 CSV" : "导出筛选 CSV"}
            </button>
            <button
              type="button"
              onClick={() => void exportQuestionnaireWorkbook()}
              disabled={loading}
              className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:border-teal-500 hover:text-teal-700"
            >
              导出问卷 Excel
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>
      </header>

      <div
        className={`border-b px-5 py-2.5 transition lg:px-8 ${isDragging ? "border-teal-500 bg-teal-50" : "border-zinc-200 bg-zinc-50"}`}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
          <p>
            数据源：<strong className="text-zinc-700">{
              dataset.source.kind === "database"
                ? "本地数据库"
                : dataset.source.kind === "remote"
                  ? "线上实验数据库"
                  : dataset.source.kind === "remote-cache"
                    ? "线上实验缓存"
                    : dataset.source.kind === "combined"
                      ? "合并视图"
                      : "服务器导出快照"
            }</strong>
            <span className="mx-2 text-zinc-300">|</span>
            截止 {formatDate(dataset.source.capturedAt, true)}
            <span className="mx-2 text-zinc-300">|</span>
            共 {dataset.trials.length} 次体验
            {dataset.studySessions.length > 0 && <> · {dataset.studySessions.length} 位参与者</>}
            <span className="mx-2 text-zinc-300">|</span>
            本地 {originCounts.local} · 线上 {originCounts.online}
            {originCounts.snapshot > 0 && <> · 快照 {originCounts.snapshot}</>}
          </p>
          <p>{isDragging ? "松开即可载入 JSON 快照" : message || "可将实验导出 JSON 拖到此处"}</p>
        </div>
      </div>

      <div className="mx-auto max-w-[1680px] px-5 py-5 lg:px-8">
        <nav className="flex flex-wrap gap-1 border-b border-zinc-200" aria-label="研究后台视图">
          {([
            ["overview", "研究结论"],
            ["trials", "实验记录"],
            ["questionnaires", "问卷数据"],
            ["quality", "数据检查"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className={`border-b-2 px-4 py-3 text-sm font-medium ${
                view === key
                  ? "border-teal-600 text-teal-700"
                  : "border-transparent text-zinc-500 hover:text-zinc-900"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        <section className="mt-5 border-b border-zinc-200 pb-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(240px,1.4fr)_minmax(150px,0.7fr)_minmax(190px,0.9fr)_minmax(190px,0.9fr)_auto]">
            <FilterField label="搜索">
              <input
                value={filters.query}
                onChange={(event) => updateFilter("query", event.target.value)}
                placeholder="参与者、体验 ID、音乐"
                className="h-9 w-full rounded border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
            </FilterField>
            <FilterField label="数据来源">
              <select
                value={filters.origin}
                onChange={(event) => updateFilter("origin", event.target.value as Filters["origin"])}
                className="h-9 w-full rounded border border-zinc-300 bg-white px-2 text-sm"
              >
                <option value="all">全部来源</option>
                <option value="local">本地服务</option>
                <option value="online">线上链接</option>
                <option value="snapshot">导入快照</option>
              </select>
            </FilterField>
            <FilterField label="实验版本">
              <select
                value={filters.protocol}
                onChange={(event) => updateFilter("protocol", event.target.value)}
                className="h-9 w-full rounded border border-zinc-300 bg-white px-2 text-sm"
              >
                <option value="all">全部实验版本</option>
                {dataset.protocols.map((protocol) => (
                  <option key={protocol} value={protocol}>
                    {protocolLabel(protocol, dataset.currentProtocolVersion)}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField label="体验路径">
              <select
                value={filters.condition}
                onChange={(event) => updateFilter("condition", event.target.value as Filters["condition"])}
                className="h-9 w-full rounded border border-zinc-300 bg-white px-2 text-sm"
              >
                <option value="all">全部体验路径</option>
                <option value="multi_agent">音乐家共同聆听</option>
                <option value="single_agent">单一共创引导</option>
                <option value="unknown">未知</option>
              </select>
            </FilterField>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => setAdvancedFiltersOpen((open) => !open)}
                className="h-9 whitespace-nowrap rounded border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 hover:border-teal-500 hover:text-teal-700"
                aria-expanded={advancedFiltersOpen}
              >
                {advancedFiltersOpen ? "收起筛选" : "高级筛选"}
              </button>
            </div>
          </div>
          {advancedFiltersOpen && (
            <div className="mt-3 grid gap-3 border-t border-zinc-200 pt-3 md:grid-cols-2 xl:grid-cols-5">
              <FilterField label="流程状态">
                <select
                  value={filters.status}
                  onChange={(event) => updateFilter("status", event.target.value)}
                  className="h-9 w-full rounded border border-zinc-300 bg-white px-2 text-sm"
                >
                  <option value="all">全部状态</option>
                  {Object.entries(STATUS_LABELS).map(([status, label]) => (
                    <option key={status} value={status}>{label}</option>
                  ))}
                </select>
              </FilterField>
              <FilterField label="问卷完整度">
                <select
                  value={filters.questionnaire}
                  onChange={(event) => updateFilter("questionnaire", event.target.value as Filters["questionnaire"])}
                  className="h-9 w-full rounded border border-zinc-300 bg-white px-2 text-sm"
                >
                  <option value="all">全部</option>
                  <option value="complete">完整</option>
                  <option value="incomplete">不完整</option>
                </select>
              </FilterField>
              <FilterField label="记录检查">
                <select
                  value={filters.issue}
                  onChange={(event) => updateFilter("issue", event.target.value as Filters["issue"])}
                  className="h-9 w-full rounded border border-zinc-300 bg-white px-2 text-sm"
                >
                  <option value="all">全部</option>
                  <option value="with-issues">有提醒</option>
                  <option value="without-issues">无提醒</option>
                </select>
              </FilterField>
              <FilterField label="开始日期">
                <input
                  type="date"
                  value={filters.from}
                  onChange={(event) => updateFilter("from", event.target.value)}
                  className="h-9 w-full rounded border border-zinc-300 bg-white px-2 text-sm"
                />
              </FilterField>
              <FilterField label="结束日期">
                <input
                  type="date"
                  value={filters.to}
                  onChange={(event) => updateFilter("to", event.target.value)}
                  className="h-9 w-full rounded border border-zinc-300 bg-white px-2 text-sm"
                />
              </FilterField>
            </div>
          )}
          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-zinc-500">
            <p>当前统计：{filteredTrials.length} 次体验 / 数据源共 {dataset.trials.length} 次</p>
            <button
              type="button"
              onClick={() => setFilters({ ...INITIAL_FILTERS, protocol: "all" })}
              className="font-medium text-teal-700 hover:underline"
            >
              清除筛选并显示全部版本
            </button>
          </div>
        </section>

        <div className="py-7">
          {view === "overview" && (
            <OverviewView
              trials={filteredTrials}
              allTrials={dataset.trials}
              studySessions={filteredStudySessions}
              currentProtocolVersion={dataset.currentProtocolVersion}
            />
          )}
          {view === "trials" && <TrialsView trials={filteredTrials} onSelect={setSelectedTrial} />}
          {view === "questionnaires" && (
            <QuestionnairesView
              trials={filteredTrials}
              studySessions={filteredStudySessions}
              onSelect={setSelectedTrial}
            />
          )}
          {view === "quality" && (
            <QualityView
              trials={filteredTrials}
              studySessions={filteredStudySessions}
              onSelect={setSelectedTrial}
            />
          )}
        </div>
      </div>

      {selectedTrial && (
        <TrialDrawer
          trial={selectedTrial}
          currentProtocolVersion={dataset.currentProtocolVersion}
          onClose={() => setSelectedTrial(null)}
        />
      )}
    </main>
  );
}
