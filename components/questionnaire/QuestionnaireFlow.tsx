"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { NOT_APPLICABLE_VALUE, validateQuestionnaireAnswers } from "@/lib/questionnaires";
import type {
  QuestionnaireAnswer,
  QuestionnaireAnswers,
  QuestionnaireDefinition,
  QuestionnaireMedia,
  QuestionnaireQuestion,
} from "@/lib/questionnaires";

type SaveState = "idle" | "saving" | "saved" | "error";

interface QuestionnaireFlowProps {
  definition: QuestionnaireDefinition;
  answers: QuestionnaireAnswers;
  language: "zh" | "en";
  media?: QuestionnaireMedia;
  onAnswersChange: (answers: QuestionnaireAnswers) => void;
  onSave: (answers: QuestionnaireAnswers) => Promise<void>;
  onComplete: (answers: QuestionnaireAnswers) => Promise<void>;
  onSaveStateChange?: (state: SaveState) => void;
}

const COPY = {
  zh: {
    previous: "上一页",
    next: "下一页",
    complete: "完成本模块",
    saving: "正在保存",
    saved: "已自动保存",
    error: "保存失败，将在下次修改时重试",
    unanswered: "请选择答案",
    optional: "选填",
    notSelected: "未选择",
    notApplicable: "不适用",
    page: "页",
    item: "题",
  },
  en: {
    previous: "Previous",
    next: "Next",
    complete: "Complete section",
    saving: "Saving",
    saved: "Saved automatically",
    error: "Save failed. The next change will retry.",
    unanswered: "Please select an answer",
    optional: "Optional",
    notSelected: "Not selected",
    notApplicable: "Not applicable",
    page: "Page",
    item: "items",
  },
};

function rangeValues(min: number, max: number, step: number): number[] {
  const values: number[] = [];
  for (let value = min; value <= max; value += step) values.push(value);
  return values;
}

function QuestionField({
  question,
  value,
  error,
  language,
  onChange,
}: {
  question: QuestionnaireQuestion;
  value: QuestionnaireAnswer | undefined;
  error: boolean;
  language: "zh" | "en";
  onChange: (value: QuestionnaireAnswer) => void;
}) {
  const copy = COPY[language];
  const shellClass = `border-l-2 px-4 py-3 transition-colors ${
    error ? "border-[#b64d4d] bg-[#fff4f1]" : "border-[#c8c2b5] bg-white/42"
  }`;

  return (
    <fieldset className={shellClass}>
      <legend className="w-full text-[15px] font-medium leading-6 text-[#20272a]">
        {question.prompt}
        {!question.required && <span className="ml-2 text-xs font-normal text-[#758087]">{copy.optional}</span>}
      </legend>
      {question.help && <p className="mt-1 text-xs leading-5 text-[#69757a]">{question.help}</p>}

      {question.kind === "scale" && question.presentation === "slider" ? (
        <div className="mt-4">
          <div className="mb-2 flex items-end justify-between gap-4">
            <span className="text-xs text-[#667177]">{question.minLabel}</span>
            <output className="min-w-14 border border-[#9ca9a9] bg-[#f7f6f1] px-3 py-1 text-center font-mono text-sm font-semibold text-[#1c554e]">
              {typeof value === "number" ? value : copy.notSelected}
            </output>
            <span className="text-right text-xs text-[#667177]">{question.maxLabel}</span>
          </div>
          <input
            type="range"
            min={question.min}
            max={question.max}
            step={question.step}
            value={typeof value === "number" ? value : question.min}
            onChange={(event) => onChange(Number(event.target.value))}
            className="h-2 w-full cursor-pointer accent-[#2f6f66]"
            aria-label={question.prompt}
          />
          <div className="mt-1 flex justify-between font-mono text-[10px] text-[#879196]">
            <span>{question.min}</span>
            <span>{question.max}</span>
          </div>
        </div>
      ) : question.kind === "scale" ? (
        <div className="mt-3">
          <div className="grid grid-flow-col auto-cols-fr gap-1.5" role="group" aria-label={question.prompt}>
            {rangeValues(question.min, question.max, question.step).map((score) => (
              <button
                key={score}
                type="button"
                onClick={() => onChange(score)}
                aria-pressed={value === score}
                className={`h-9 min-w-0 border text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f6f66] ${
                  value === score
                    ? "border-[#2f6f66] bg-[#2f6f66] text-white"
                    : "border-[#bec7c5] bg-[#fbfaf6] text-[#465156] hover:border-[#628f88] hover:bg-[#edf4f1]"
                }`}
              >
                {score}
              </button>
            ))}
          </div>
          <div className="mt-1.5 flex justify-between gap-3 text-[10px] text-[#758087]">
            <span>{question.minLabel}</span>
            <span>{question.maxLabel}</span>
          </div>
          {question.allowNotApplicable && (
            <button
              type="button"
              onClick={() => onChange(NOT_APPLICABLE_VALUE)}
              aria-pressed={value === NOT_APPLICABLE_VALUE}
              className={`mt-2 h-8 border px-3 text-xs transition ${
                value === NOT_APPLICABLE_VALUE
                  ? "border-[#6f7b80] bg-[#59656a] text-white"
                  : "border-[#c8cfcd] text-[#657176] hover:bg-[#edf0ee]"
              }`}
            >
              {copy.notApplicable}
            </button>
          )}
        </div>
      ) : question.kind === "choice" ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2" role="group" aria-label={question.prompt}>
          {question.options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={value === option.value}
              className={`min-h-10 border px-3 py-2 text-left text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f6f66] ${
                value === option.value
                  ? "border-[#2f6f66] bg-[#e3eeea] font-semibold text-[#1f554e]"
                  : "border-[#c4cbc8] bg-[#fbfaf6] text-[#475258] hover:border-[#71948e]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : question.kind === "pair" ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2" role="group" aria-label={question.prompt}>
          {[question.left, question.right].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={value === option.value}
              className={`min-h-16 border px-4 py-3 text-left text-sm leading-5 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f6f66] ${
                value === option.value
                  ? "border-[#c28a2f] bg-[#fff4d9] font-semibold text-[#5d431d]"
                  : "border-[#c4cbc8] bg-[#fbfaf6] text-[#475258] hover:border-[#c28a2f]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : question.kind === "number" ? (
        <label className="mt-3 flex max-w-56 items-center border border-[#b8c2c0] bg-[#fbfaf6] focus-within:border-[#2f6f66]">
          <input
            type="number"
            min={question.min}
            max={question.max}
            step={question.step}
            value={typeof value === "number" ? value : ""}
            onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))}
            className="h-11 min-w-0 flex-1 bg-transparent px-3 text-sm text-[#273136] outline-none"
          />
          {question.suffix && <span className="border-l border-[#d0d5d2] px-3 text-xs text-[#68747a]">{question.suffix}</span>}
        </label>
      ) : (
        <textarea
          value={typeof value === "string" ? value : ""}
          maxLength={question.maxLength}
          rows={question.multiline ? 4 : 2}
          placeholder={question.placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="mt-3 w-full resize-none border border-[#b8c2c0] bg-[#fbfaf6] px-3 py-2 text-sm leading-6 text-[#273136] outline-none placeholder:text-[#929b9f] focus:border-[#2f6f66]"
        />
      )}
      {error && <p className="mt-2 text-xs font-medium text-[#a33f3f]">{copy.unanswered}</p>}
    </fieldset>
  );
}

export default function QuestionnaireFlow({
  definition,
  answers,
  language,
  media,
  onAnswersChange,
  onSave,
  onComplete,
  onSaveStateChange,
}: QuestionnaireFlowProps) {
  const copy = COPY[language];
  const [pageIndex, setPageIndex] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const saveSequence = useRef(0);
  const pages = useMemo(() => {
    const result: QuestionnaireQuestion[][] = [];
    for (let index = 0; index < definition.questions.length; index += definition.pageSize) {
      result.push(definition.questions.slice(index, index + definition.pageSize));
    }
    return result;
  }, [definition]);
  const page = pages[pageIndex] || [];

  useEffect(() => {
    if (Object.keys(answers).length === 0) return;
    const sequence = saveSequence.current + 1;
    saveSequence.current = sequence;
    const timer = window.setTimeout(() => {
      setSaveState("saving");
      onSaveStateChange?.("saving");
      void onSave(answers)
        .then(() => {
          if (saveSequence.current !== sequence) return;
          setSaveState("saved");
          onSaveStateChange?.("saved");
        })
        .catch(() => {
          if (saveSequence.current !== sequence) return;
          setSaveState("error");
          onSaveStateChange?.("error");
        });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [answers, onSave, onSaveStateChange]);

  const updateAnswer = (id: string, value: QuestionnaireAnswer) => {
    onAnswersChange({ ...answers, [id]: value });
    setErrors((current) => {
      if (!current[id]) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  const validatePage = () => {
    const validation = validateQuestionnaireAnswers(definition, answers);
    const pageErrors = Object.fromEntries(
      page
        .filter((question) => validation.errors[question.id])
        .map((question) => [question.id, validation.errors[question.id]])
    );
    setErrors(pageErrors);
    return Object.keys(pageErrors).length === 0;
  };

  const goNext = () => {
    if (!validatePage()) return;
    setPageIndex((current) => Math.min(pages.length - 1, current + 1));
  };

  const complete = async () => {
    const validation = validateQuestionnaireAnswers(definition, answers);
    if (!validation.valid) {
      setErrors(validation.errors);
      const firstInvalid = definition.questions.findIndex((question) => validation.errors[question.id]);
      if (firstInvalid >= 0) setPageIndex(Math.floor(firstInvalid / definition.pageSize));
      return;
    }
    try {
      await onComplete(answers);
    } catch {
      setSaveState("error");
      onSaveStateChange?.("error");
    }
  };

  const answeredCount = definition.questions.filter((question) => {
    const value = answers[question.id];
    return value !== undefined && value !== null && value !== "";
  }).length;
  const progress = definition.questions.length === 0
    ? 0
    : Math.round((answeredCount / definition.questions.length) * 100);

  return (
    <section className="flex h-full min-h-0 flex-col bg-[#f7f5ef] text-[#20272a]">
      <header className="shrink-0 border-b border-[#c9c4b8] px-5 py-4 sm:px-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase text-[#2f6f66]">{definition.shortTitle}</p>
            <h2 className="mt-1 font-serif text-2xl font-semibold text-[#20272a]">{definition.title}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[#667177]">{definition.intro}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-xs text-[#536065]">{pageIndex + 1}/{pages.length} {copy.page}</p>
            <p className={`mt-1 text-[10px] ${saveState === "error" ? "text-[#a33f3f]" : "text-[#778287]"}`}>
              {saveState === "saving" ? copy.saving : saveState === "saved" ? copy.saved : saveState === "error" ? copy.error : ""}
            </p>
          </div>
        </div>
        <div className="mt-4 h-1 bg-[#d9d6cd]" aria-label={`${progress}%`}>
          <div className="h-full bg-[#2f6f66] transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
        {media && (
          <figure className="mb-5 grid gap-4 border-y border-[#c9c4b8] bg-[#ecebe5] p-3 sm:grid-cols-[180px_1fr]">
            <div className="relative aspect-video overflow-hidden bg-[#1d2327]">
              <Image src={media.src} alt={media.alt} fill sizes="180px" loading="eager" className="object-contain" unoptimized />
            </div>
            <figcaption className="self-center">
              <p className="font-mono text-[10px] uppercase text-[#2f6f66]">{media.label}</p>
              {media.detail && <p className="mt-1 text-sm leading-6 text-[#5f6a6f]">{media.detail}</p>}
            </figcaption>
          </figure>
        )}
        <div className="space-y-3">
          {page.map((question) => (
            <QuestionField
              key={question.id}
              question={question}
              value={answers[question.id]}
              error={Boolean(errors[question.id])}
              language={language}
              onChange={(value) => updateAnswer(question.id, value)}
            />
          ))}
        </div>
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-[#c9c4b8] bg-[#eeece5] px-5 py-3 sm:px-7">
        <p className="hidden text-xs text-[#6e797d] sm:block">{answeredCount}/{definition.questions.length} {copy.item}</p>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={() => setPageIndex((current) => Math.max(0, current - 1))} disabled={pageIndex === 0} className="h-10 border border-[#9fa8a5] px-4 text-sm font-medium text-[#475156] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-35">
            {copy.previous}
          </button>
          {pageIndex < pages.length - 1 ? (
            <button type="button" onClick={goNext} className="h-10 bg-[#2f6f66] px-5 text-sm font-semibold text-white transition hover:bg-[#285f57]">{copy.next}</button>
          ) : (
            <button type="button" onClick={() => void complete()} className="h-10 bg-[#c28a2f] px-5 text-sm font-semibold text-[#201a10] transition hover:bg-[#d39a3b]">{copy.complete}</button>
          )}
        </div>
      </footer>
    </section>
  );
}
