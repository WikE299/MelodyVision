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
  exportResearchTrialsCsv,
  summarizeResearchTrials,
  type ResearchChoiceMetric,
  type ResearchCondition,
  type ResearchDashboardDataset,
  type ResearchDataIssue,
  type ResearchScoreMetric,
  type ResearchTrialRecord,
} from "@/lib/research-dashboard";
import { buildResearchThumbnailUrl } from "@/lib/research-thumbnail";

type View = "overview" | "trials" | "quality";

interface Filters {
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
  multi_agent: "路径 A · 音乐家共创",
  single_agent: "路径 B · 单人引导",
  unknown: "未知条件",
};

const STATUS_LABELS: Record<string, string> = {
  created: "已创建",
  interacting: "交互中",
  generating: "生成中",
  evaluating: "评价中",
  completed: "已完成",
};

const INITIAL_FILTERS: Filters = {
  condition: "all",
  protocol: "",
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

function percent(value: number, total: number): number {
  return total ? Math.round((value / total) * 1000) / 10 : 0;
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

function protocolLabel(value: string, currentProtocolVersion: string): string {
  if (value === currentProtocolVersion) return "当前实验版本";
  if (value === "v2-13-blind-comparison") return "历史版本 · 盲测流程";
  return `历史版本 · ${value}`;
}

function meanScore(
  trials: ResearchTrialRecord[],
  condition: ResearchCondition,
  field: string
): { mean: number | null; count: number } {
  const values = trials
    .filter((trial) => trial.condition === condition)
    .map((trial) => Number(trial.artworkEvaluation?.[field]))
    .filter((value) => Number.isFinite(value) && value >= 1 && value <= 5);
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

function ChoiceBar({ metric }: { metric: ResearchChoiceMetric }) {
  const coCreatedWidth = percent(metric.coCreated, metric.count);
  const baselineWidth = percent(metric.baseline, metric.count);
  const tieWidth = percent(metric.tie, metric.count);
  return (
    <article className="border-b border-zinc-200 py-4 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-zinc-900">{metric.label}</h3>
        <span className="text-xs text-zinc-500">n={metric.count}</span>
      </div>
      <div className="mt-3 flex h-3 overflow-hidden rounded-sm bg-zinc-100">
        <div className="bg-teal-500" style={{ width: `${coCreatedWidth}%` }} />
        <div className="bg-blue-500" style={{ width: `${baselineWidth}%` }} />
        <div className="bg-zinc-400" style={{ width: `${tieWidth}%` }} />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-zinc-600">
        <span><i className="mr-1 inline-block h-2 w-2 bg-teal-500" />共创 {metric.coCreated}</span>
        <span><i className="mr-1 inline-block h-2 w-2 bg-blue-500" />音乐直出 {metric.baseline}</span>
        <span><i className="mr-1 inline-block h-2 w-2 bg-zinc-400" />相近 {metric.tie}</span>
      </div>
    </article>
  );
}

function ConditionComparison({ trials }: { trials: ResearchTrialRecord[] }) {
  const dimensions = [
    ["immersion_score", "沉浸感"],
    ["agency_score", "主体感"],
    ["ownership_score", "作品所有权"],
    ["satisfaction_score", "整体满意度"],
  ] as const;
  const multiCount = trials.filter(
    (trial) => trial.condition === "multi_agent" && trial.artworkEvaluation
  ).length;
  const singleCount = trials.filter(
    (trial) => trial.condition === "single_agent" && trial.artworkEvaluation
  ).length;

  return (
    <div className="overflow-x-auto border-y border-zinc-200 bg-white">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-zinc-50 text-xs text-zinc-500">
          <tr>
            <th className="w-36 px-4 py-3 font-medium">评价维度</th>
            <th className="px-4 py-3 font-medium">路径 A · 音乐家共创（n={multiCount}）</th>
            <th className="px-4 py-3 font-medium">路径 B · 单人引导（n={singleCount}）</th>
          </tr>
        </thead>
        <tbody>
          {dimensions.map(([field, label]) => {
            const multi = meanScore(trials, "multi_agent", field);
            const single = meanScore(trials, "single_agent", field);
            return (
              <tr key={field} className="border-t border-zinc-100">
                <th className="px-4 py-4 font-semibold text-zinc-800">{label}</th>
                {[multi, single].map((result, index) => (
                  <td key={index} className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-2 flex-1 overflow-hidden rounded-sm bg-zinc-100">
                        <div
                          className={index === 0 ? "h-full bg-teal-500" : "h-full bg-blue-500"}
                          style={{ width: `${result.mean === null ? 0 : (result.mean / 5) * 100}%` }}
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
  const checks = [
    Boolean(trial.artworkEvaluation),
    Boolean(trial.comparison),
    Boolean(trial.manipulationCheck),
  ];
  return (
    <div className="flex items-center gap-1" title="画作评价 / 作品对比 / 交互体验">
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
  currentProtocolVersion,
}: {
  trials: ResearchTrialRecord[];
  allTrials: ResearchTrialRecord[];
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
          <SummaryCard label="历史版本" value={String(historicalTrials.length)} detail="默认不与当前版本合并" tone="zinc" />
          <SummaryCard label="需要检查" value={String(errorTrials.length)} detail="存在生成或记录异常" tone="rose" />
        </div>
        <div className="mt-4 border-l-4 border-blue-500 bg-blue-50 px-4 py-3 text-sm leading-relaxed text-blue-900">
          下方趋势默认基于当前筛选得到的 <strong>{summary.totalTrials}</strong> 次体验。
          当前样本量较小，结果只用于观察趋势，不代表统计显著性。
        </div>
      </section>

      <section>
        <SectionTitle
          title="两种体验路径带来了什么差异？"
          description="以下为两组用户在关键体验维度上的平均分，满分为 5 分。"
        />
        <ConditionComparison trials={trials} />
      </section>

      <section className="grid gap-8 xl:grid-cols-[1.05fr_1fr]">
        <div>
          <SectionTitle
            title="共创是否带来了更匹配的作品？"
            description="用户在共创作品与音乐直出作品之间的选择。"
          />
          <div className="border-y border-zinc-200 bg-white px-4">
            {summary.choices.map((metric) => <ChoiceBar key={metric.key} metric={metric} />)}
          </div>
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
          <SectionTitle title="画作评价" description="每个柱状条对应 1–5 分的作答人数。" />
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
        <table className="w-full min-w-[1120px] text-left text-xs">
          <thead className="bg-zinc-50 text-zinc-500">
            <tr>
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

function QualityView({
  trials,
  onSelect,
}: {
  trials: ResearchTrialRecord[];
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
            这些记录仍可查看，但默认不与当前版本合并统计。
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

      <section>
        <SectionTitle title="异常记录" description={`${issues.length} 个真实异常，可按单次体验追溯。`} />
        <div className="overflow-x-auto border-y border-zinc-200 bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-500">
              <tr>
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
  const [dataset, setDataset] = useState(initialData);
  const [view, setView] = useState<View>("overview");
  const [filters, setFilters] = useState<Filters>({
    ...INITIAL_FILTERS,
    protocol: initialData.protocols.includes(initialData.currentProtocolVersion)
      ? initialData.currentProtocolVersion
      : "all",
  });
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

  const replaceDataset = useCallback((next: ResearchDashboardDataset, sourceMessage: string) => {
    setDataset(next);
    setFilters({
      ...INITIAL_FILTERS,
      protocol: next.protocols.includes(next.currentProtocolVersion)
        ? next.currentProtocolVersion
        : "all",
    });
    setSelectedTrial(null);
    setMessage(sourceMessage);
  }, []);

  const refreshDatabase = async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/research/data", { cache: "no-store" });
      if (!response.ok) throw new Error("无法读取本地研究数据库");
      replaceDataset(await response.json() as ResearchDashboardDataset, "已刷新本地数据库");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "刷新失败");
    } finally {
      setLoading(false);
    }
  };

  const syncRemoteData = useCallback(async (automatic = false) => {
    setLoading(true);
    if (!automatic) setMessage("");
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
      const sourceMessage = result.transport === "cache"
        ? `线上暂时不可用，已载入最近缓存${result.warning ? `：${result.warning}` : ""}`
        : "线上数据已同步";
      replaceDataset(result.dataset, sourceMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "线上同步失败");
    } finally {
      setLoading(false);
    }
  }, [replaceDataset]);

  useEffect(() => {
    if (!remoteSyncEnabled || autoSyncAttemptedRef.current) return;
    autoSyncAttemptedRef.current = true;
    void syncRemoteData(true);
  }, [remoteSyncEnabled, syncRemoteData]);

  const importSnapshot = async (file: File) => {
    setLoading(true);
    setMessage("");
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const next = buildResearchDashboardDataset(parsed, "snapshot");
      replaceDataset(next, `已载入快照：${file.name}`);
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
    downloadText(
      exportResearchTrialsCsv(filteredTrials),
      `melodyvision-research-${dataset.source.capturedAt.slice(0, 10)}.csv`,
      "text/csv;charset=utf-8"
    );
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
              导出筛选 CSV
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
                  : "服务器导出快照"
            }</strong>
            <span className="mx-2 text-zinc-300">|</span>
            截止 {formatDate(dataset.source.capturedAt, true)}
            <span className="mx-2 text-zinc-300">|</span>
            共 {dataset.trials.length} 次体验
          </p>
          <p>{isDragging ? "松开即可载入 JSON 快照" : message || "可将实验导出 JSON 拖到此处"}</p>
        </div>
      </div>

      <div className="mx-auto max-w-[1680px] px-5 py-5 lg:px-8">
        <nav className="flex flex-wrap gap-1 border-b border-zinc-200" aria-label="研究后台视图">
          {([
            ["overview", "研究结论"],
            ["trials", "实验记录"],
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
          <div className="grid gap-3 md:grid-cols-[minmax(240px,1.4fr)_minmax(190px,0.9fr)_minmax(190px,0.9fr)_auto]">
            <FilterField label="搜索">
              <input
                value={filters.query}
                onChange={(event) => updateFilter("query", event.target.value)}
                placeholder="参与者、体验 ID、音乐"
                className="h-9 w-full rounded border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
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
                <option value="multi_agent">路径 A · 音乐家共创</option>
                <option value="single_agent">路径 B · 单人引导</option>
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
              currentProtocolVersion={dataset.currentProtocolVersion}
            />
          )}
          {view === "trials" && <TrialsView trials={filteredTrials} onSelect={setSelectedTrial} />}
          {view === "quality" && <QualityView trials={filteredTrials} onSelect={setSelectedTrial} />}
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
