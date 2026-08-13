"use client";

import { useCallback, useMemo, useState } from "react";
import QuestionnaireFlow from "@/components/questionnaire/QuestionnaireFlow";
import {
  createCompleteAnswers,
  createPartialAnswers,
  getQuestionnaireDefinition,
  getQuestionnaireDefinitions,
  scoreQuestionnaire,
  type QuestionnaireAnswers,
  type QuestionnaireInstrument,
  type QuestionnaireLanguage,
  type QuestionnaireScoreResult,
} from "@/lib/questionnaires";

type Scenario = "empty" | "partial" | "complete";
type SaveState = "idle" | "saving" | "saved" | "error";

const INSTRUMENT_DETAIL: Record<QuestionnaireInstrument, { zh: string; en: string }> = {
  background: { zh: "8题 · 实验前", en: "8 items · pre-study" },
  csi: { zh: "10题 · 每次体验后", en: "10 items · after each experience" },
  agency_ownership: { zh: "2题 · 每次体验后", en: "2 items · after each experience" },
  sus: { zh: "10题 · 每次体验后", en: "10 items · after each experience" },
  raw_tlx: { zh: "6题 · 每次体验后", en: "6 items · after each experience" },
  manipulation_check: { zh: "2题 · 每次体验后", en: "2 items · after each experience" },
  csi_weighting: { zh: "10组 · 仅一次", en: "10 pairs · once" },
  image_alignment: { zh: "3题 · 每张作品", en: "3 items · per artwork" },
  session_preference: { zh: "1题 + 原因", en: "1 item + reason" },
};

const UI = {
  zh: {
    lab: "问卷实验室",
    subtitle: "正式实验量表 · 独立验收",
    modules: "问卷模块",
    scenario: "测试场景",
    empty: "空白开始",
    partial: "填写一半",
    complete: "全部填充",
    controls: "实验室控制",
    fill: "填入测试答案",
    reset: "清空当前模块",
    restore: "读取本地缓存",
    fail: "模拟保存失败",
    record: "实时记录",
    save: "保存状态",
    completion: "模块状态",
    completed: "已完成",
    incomplete: "未完成",
    score: "计算结果",
    answers: "原始答案",
    noScore: "当前模块不计算总分",
    completionToast: "模块提交成功",
    participantView: "参与者视图",
  },
  en: {
    lab: "Questionnaire Lab",
    subtitle: "Formal study instruments · isolated review",
    modules: "Modules",
    scenario: "Scenario",
    empty: "Start empty",
    partial: "Half complete",
    complete: "Fill all",
    controls: "Lab controls",
    fill: "Fill test answers",
    reset: "Clear this module",
    restore: "Restore local cache",
    fail: "Simulate save failure",
    record: "Live record",
    save: "Save state",
    completion: "Module state",
    completed: "Completed",
    incomplete: "Incomplete",
    score: "Calculated result",
    answers: "Raw answers",
    noScore: "This module has no combined score",
    completionToast: "Section submitted",
    participantView: "Participant view",
  },
};

const IMAGE_MEDIA: Record<QuestionnaireLanguage, { src: string; alt: string; label: string; detail: string }> = {
  zh: {
    src: "/generated/d147c240-ac74-4520-bd58-981a5fceda3c.png",
    alt: "用于问卷实验室的示例生成画作",
    label: "作品 A",
    detail: "请把它视为刚才听到的音乐所生成的作品。实验中这里不会显示生成方式。",
  },
  en: {
    src: "/generated/d147c240-ac74-4520-bd58-981a5fceda3c.png",
    alt: "Example generated artwork for the questionnaire lab",
    label: "Artwork A",
    detail: "Treat this as an artwork generated from the music you just heard. The generation method remains hidden during the study.",
  },
};

function scenarioAnswers(
  instrument: QuestionnaireInstrument,
  language: QuestionnaireLanguage,
  scenario: Scenario
): QuestionnaireAnswers {
  const definition = getQuestionnaireDefinition(instrument, language);
  if (scenario === "partial") return createPartialAnswers(definition);
  if (scenario === "complete") return createCompleteAnswers(definition);
  return {};
}

function ScorePanel({ result, noScore }: { result: QuestionnaireScoreResult; noScore: string }) {
  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between border-b border-[#c8d0d2] pb-2">
        <span className="text-[#647177]">complete</span>
        <strong className={result.complete ? "text-[#21665c]" : "text-[#a04747]"}>{String(result.complete)}</strong>
      </div>
      <div className="flex items-center justify-between border-b border-[#c8d0d2] pb-2">
        <span className="text-[#647177]">total</span>
        <strong className="font-mono text-[#26343a]">{result.total ?? "—"}</strong>
      </div>
      {Object.keys(result.metrics).length > 0 ? (
        <dl className="space-y-1.5">
          {Object.entries(result.metrics).map(([key, value]) => (
            <div key={key} className="grid grid-cols-[1fr_auto] gap-3">
              <dt className="truncate font-mono text-[10px] text-[#6d797e]" title={key}>{key}</dt>
              <dd className="font-mono font-semibold text-[#26343a]">{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="leading-5 text-[#788489]">{noScore}</p>
      )}
    </div>
  );
}

export default function QuestionnaireLabClient() {
  const [language, setLanguage] = useState<QuestionnaireLanguage>("zh");
  const [instrument, setInstrument] = useState<QuestionnaireInstrument>("background");
  const [scenario, setScenario] = useState<Scenario>("empty");
  const [answers, setAnswers] = useState<QuestionnaireAnswers>({});
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [notice, setNotice] = useState("");
  const [flowKey, setFlowKey] = useState(0);
  const copy = UI[language];
  const definitions = useMemo(() => getQuestionnaireDefinitions(language), [language]);
  const definition = useMemo(() => getQuestionnaireDefinition(instrument, language), [instrument, language]);
  const score = useMemo(() => scoreQuestionnaire(instrument, answers), [answers, instrument]);
  const storageKey = `mv-questionnaire-lab:${definition.version}:${language}:${instrument}`;

  const applyScenario = useCallback((nextScenario: Scenario) => {
    setScenario(nextScenario);
    setAnswers(scenarioAnswers(instrument, language, nextScenario));
    setCompleted(false);
    setNotice("");
    setSaveState("idle");
    setFlowKey((current) => current + 1);
  }, [instrument, language]);

  const selectInstrument = (nextInstrument: QuestionnaireInstrument) => {
    setInstrument(nextInstrument);
    setScenario("empty");
    setAnswers({});
    setCompleted(false);
    setNotice("");
    setSaveState("idle");
    setFlowKey((current) => current + 1);
  };

  const switchLanguage = (nextLanguage: QuestionnaireLanguage) => {
    setLanguage(nextLanguage);
    setScenario("empty");
    setAnswers({});
    setCompleted(false);
    setNotice("");
    setFlowKey((current) => current + 1);
  };

  const save = useCallback(async (nextAnswers: QuestionnaireAnswers) => {
    await new Promise((resolve) => window.setTimeout(resolve, 260));
    if (simulateFailure) throw new Error("Simulated save failure");
    window.localStorage.setItem(storageKey, JSON.stringify(nextAnswers));
  }, [simulateFailure, storageKey]);

  const complete = useCallback(async (nextAnswers: QuestionnaireAnswers) => {
    await save(nextAnswers);
    setCompleted(true);
    setNotice(copy.completionToast);
  }, [copy.completionToast, save]);

  const restore = () => {
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return;
    try {
      setAnswers(JSON.parse(saved));
      setScenario("partial");
      setCompleted(false);
      setFlowKey((current) => current + 1);
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  };

  return (
    <main className="h-screen min-h-[640px] overflow-hidden bg-[#dfe4e3] text-[#20272a]">
      <header className="flex h-[70px] items-center justify-between border-b border-[#7f8d90] bg-[#17242b] px-5 text-[#f5f0e4] lg:px-7">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase text-[#d4a54c]">MelodyVision Research</p>
          <h1 className="truncate font-serif text-xl font-semibold">{copy.lab}</h1>
        </div>
        <div className="flex items-center gap-4">
          <p className="hidden text-xs text-[#aebcc0] sm:block">{copy.subtitle}</p>
          <div className="flex border border-[#5f7176] p-0.5" role="group" aria-label="Language">
            {(["zh", "en"] as const).map((item) => (
              <button key={item} type="button" onClick={() => switchLanguage(item)} aria-pressed={language === item} className={`h-8 min-w-11 px-2 font-mono text-xs transition ${language === item ? "bg-[#d4a54c] text-[#1e2527]" : "text-[#bfcbce] hover:bg-[#27383f]"}`}>
                {item === "zh" ? "中文" : "EN"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="grid h-[calc(100%-70px)] min-h-0 grid-cols-1 lg:grid-cols-[238px_minmax(520px,1fr)_300px]">
        <aside className="hidden min-h-0 overflow-y-auto border-r border-[#809093] bg-[#1f3037] p-4 text-[#dbe3e3] lg:block">
          <p className="mb-3 font-mono text-[10px] uppercase text-[#9eb0b4]">{copy.modules}</p>
          <nav className="space-y-1" aria-label={copy.modules}>
            {definitions.map((item, index) => (
              <button key={item.instrument} type="button" onClick={() => selectInstrument(item.instrument)} aria-current={instrument === item.instrument ? "page" : undefined} className={`grid w-full grid-cols-[24px_1fr] gap-2 border-l-2 px-2 py-2.5 text-left transition ${instrument === item.instrument ? "border-[#d4a54c] bg-[#2e4148] text-white" : "border-transparent text-[#bbc9cc] hover:bg-[#273940]"}`}>
                <span className="font-mono text-[10px] text-[#d4a54c]">{String(index + 1).padStart(2, "0")}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{item.shortTitle}</span>
                  <span className="mt-0.5 block text-[10px] text-[#91a3a7]">{INSTRUMENT_DETAIL[item.instrument][language]}</span>
                </span>
              </button>
            ))}
          </nav>

          <div className="mt-6 border-t border-[#516268] pt-4">
            <p className="mb-2 font-mono text-[10px] uppercase text-[#9eb0b4]">{copy.scenario}</p>
            <select value={scenario} onChange={(event) => applyScenario(event.target.value as Scenario)} className="h-10 w-full border border-[#607278] bg-[#17242b] px-2 text-xs text-[#e2e8e8] outline-none focus:border-[#d4a54c]">
              <option value="empty">{copy.empty}</option>
              <option value="partial">{copy.partial}</option>
              <option value="complete">{copy.complete}</option>
            </select>
          </div>

          <div className="mt-5 border-t border-[#516268] pt-4">
            <p className="mb-2 font-mono text-[10px] uppercase text-[#9eb0b4]">{copy.controls}</p>
            <div className="space-y-2">
              <button type="button" onClick={() => applyScenario("complete")} className="h-9 w-full border border-[#607278] px-3 text-left text-xs transition hover:border-[#d4a54c] hover:bg-[#2a3c43]">{copy.fill}</button>
              <button type="button" onClick={() => applyScenario("empty")} className="h-9 w-full border border-[#607278] px-3 text-left text-xs transition hover:border-[#d4a54c] hover:bg-[#2a3c43]">{copy.reset}</button>
              <button type="button" onClick={restore} className="h-9 w-full border border-[#607278] px-3 text-left text-xs transition hover:border-[#d4a54c] hover:bg-[#2a3c43]">{copy.restore}</button>
              <label className="flex min-h-9 cursor-pointer items-center justify-between border border-[#607278] px-3 text-xs hover:border-[#b85d55]">
                <span>{copy.fail}</span>
                <input type="checkbox" checked={simulateFailure} onChange={(event) => setSimulateFailure(event.target.checked)} className="h-4 w-4 accent-[#b85d55]" />
              </label>
            </div>
          </div>
        </aside>

        <section className="min-h-0 bg-[#f7f5ef]">
          <div className="flex h-9 items-center justify-between border-b border-[#c8c4b8] bg-[#eeece5] px-5 font-mono text-[10px] uppercase text-[#6f797d]">
            <span>{copy.participantView}</span>
            <span>{definition.version}</span>
          </div>
          <div className="h-[calc(100%-36px)] min-h-0">
            <QuestionnaireFlow
              key={`${instrument}-${language}-${flowKey}`}
              definition={definition}
              answers={answers}
              language={language}
              media={instrument === "image_alignment" ? IMAGE_MEDIA[language] : undefined}
              onAnswersChange={(next) => {
                setAnswers(next);
                setCompleted(false);
                setNotice("");
              }}
              onSave={save}
              onComplete={complete}
              onSaveStateChange={setSaveState}
            />
          </div>
        </section>

        <aside className="hidden min-h-0 overflow-y-auto border-l border-[#aab4b5] bg-[#e8edee] p-4 lg:block">
          <p className="font-mono text-[10px] uppercase text-[#526269]">{copy.record}</p>
          {notice && <p className="mt-3 border-l-2 border-[#2f6f66] bg-[#f4f7f5] px-3 py-2 text-xs font-medium text-[#245f57]">{notice}</p>}
          <dl className="mt-4 grid grid-cols-2 gap-px border border-[#b9c3c4] bg-[#b9c3c4] text-xs">
            <div className="bg-[#f4f6f5] p-3"><dt className="text-[#718085]">{copy.save}</dt><dd className={`mt-1 font-mono font-semibold ${saveState === "error" ? "text-[#a04747]" : "text-[#285e57]"}`}>{saveState}</dd></div>
            <div className="bg-[#f4f6f5] p-3"><dt className="text-[#718085]">{copy.completion}</dt><dd className={`mt-1 font-semibold ${completed ? "text-[#285e57]" : "text-[#7a6561]"}`}>{completed ? copy.completed : copy.incomplete}</dd></div>
          </dl>

          <section className="mt-5 border-t border-[#b9c3c4] pt-4">
            <h2 className="mb-3 text-sm font-semibold text-[#28353a]">{copy.score}</h2>
            <ScorePanel result={score} noScore={copy.noScore} />
          </section>

          <section className="mt-5 border-t border-[#b9c3c4] pt-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-[#28353a]">{copy.answers}</h2>
              <span className="font-mono text-[10px] text-[#6c7a7f]">{Object.keys(answers).length}/{definition.questions.length}</span>
            </div>
            <pre className="max-h-[330px] overflow-auto whitespace-pre-wrap break-all border border-[#c1c9ca] bg-[#f5f7f6] p-3 font-mono text-[10px] leading-5 text-[#445158]">{JSON.stringify(answers, null, 2)}</pre>
          </section>
        </aside>
      </div>
    </main>
  );
}
