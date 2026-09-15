"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QuestionnaireFlow from "@/components/questionnaire/QuestionnaireFlow";
import FlowHeader from "@/components/FlowHeader";
import { useLanguage } from "@/lib/i18n";
import {
  fetchQuestionnaireProgress,
  saveQuestionnaireAnswers,
  type QuestionnaireProgressPayload,
} from "@/lib/questionnaire-study-client";
import { fetchStudySession } from "@/lib/experiment-study-client";
import { startDirectBaseline } from "@/lib/experiment-trial-client";
import {
  getQuestionnaireDefinition,
  type QuestionnaireAnswers,
} from "@/lib/questionnaires";

function requestedStudySessionId(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("studySessionId")?.trim()
    || sessionStorage.getItem("studySessionId")
    || localStorage.getItem("melodyvisionStudySessionId")
    || "";
}

function nextRoute(payload: QuestionnaireProgressPayload): string {
  if (payload.progress.nextAction === "select_music") return "/?study=1&stage=music";
  if (payload.progress.nextAction === "experience") return "/?study=1";
  if (payload.progress.nextAction === "result") return "/result";
  if (payload.progress.nextAction === "complete") return "/result";
  return "/study/questionnaire";
}

export default function StudyQuestionnaireClient() {
  const router = useRouter();
  const { language } = useLanguage();
  const [payload, setPayload] = useState<QuestionnaireProgressPayload | null>(null);
  const [answers, setAnswers] = useState<QuestionnaireAnswers>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const baselineStarted = useRef(new Set<string>());
  const [studySessionId] = useState(() => (
    requestedStudySessionId()
  ));
  const step = payload?.progress.nextStep || null;
  const definition = useMemo(() => (
    step ? getQuestionnaireDefinition(step.instrument, language) : null
  ), [language, step]);

  const applyPayload = useCallback((next: QuestionnaireProgressPayload) => {
    setPayload(next);
    const nextStep = next.progress.nextStep;
    const response = nextStep
      ? next.progress.responses.find((item) => item.responseKey === nextStep.key)
      : null;
    setAnswers(response?.answers || {});
  }, []);

  const startEligibleBaselines = useCallback(async (next: QuestionnaireProgressPayload) => {
    if (next.progress.baselineEligibleTrialIds.length === 0) return;
    const study = await fetchStudySession(studySessionId);
    await Promise.all(study.periodResults
      .filter((item) => next.progress.baselineEligibleTrialIds.includes(item.trial.id))
      .filter((item) => !item.baseline?.imageUrl && item.musicProfile)
      .map(async (item) => {
        if (baselineStarted.current.has(item.trial.id)) return;
        baselineStarted.current.add(item.trial.id);
        try {
          await startDirectBaseline({
            trial: item.trial,
            musicProfile: item.musicProfile!,
            musicAnalysis: item.compatibilityAnalysis || {},
          });
        } catch (baselineError) {
          setError(baselineError instanceof Error
            ? baselineError.message
            : "参照作品生成失败，请手动重试");
        }
      }));
  }, [studySessionId]);

  const restorePendingResult = useCallback(async (next: QuestionnaireProgressPayload) => {
    const trialId = next.progress.resultTrialId;
    if (!trialId) throw new Error("待评价的实验轮次缺失，请返回实验首页恢复进度");
    const study = await fetchStudySession(studySessionId);
    const periodResult = study.periodResults.find((item) => item.trial.id === trialId);
    if (!periodResult?.coCreated?.imageUrl || !periodResult.musicProfile) {
      throw new Error("待评价作品尚未准备完成，请返回实验首页恢复进度");
    }

    sessionStorage.setItem("studySessionId", study.session.id);
    sessionStorage.setItem("studySession", JSON.stringify(study.session));
    sessionStorage.setItem("studyTrial", JSON.stringify(periodResult.trial));
    sessionStorage.setItem("studyTrialId", periodResult.trial.id);
    sessionStorage.setItem("studyPeriod", String(periodResult.trial.period || 1));
    sessionStorage.setItem("interactiveCondition", periodResult.trial.condition);
    sessionStorage.setItem("experimentSessionId", periodResult.trial.sessionId);
    sessionStorage.setItem("generatedImageUrl", periodResult.coCreated.imageUrl);
    sessionStorage.setItem("generatedImagePrompt", periodResult.coCreated.prompt || "");
    sessionStorage.setItem("audioSrc", periodResult.audioUrl);
    sessionStorage.setItem("audioFileName", periodResult.musicName);
    sessionStorage.setItem("musicProfile", JSON.stringify(periodResult.musicProfile));
    sessionStorage.setItem(
      "musicAnalysis",
      JSON.stringify(periodResult.compatibilityAnalysis || {})
    );
    sessionStorage.setItem("imageGenerationMeta", JSON.stringify({
      runId: periodResult.coCreated.runId,
      trialId: periodResult.trial.id,
    }));
  }, [studySessionId]);

  const load = useCallback(async () => {
    if (!studySessionId) {
      router.replace("/?study=1");
      return;
    }
    try {
      const next = await fetchQuestionnaireProgress(studySessionId);
      applyPayload(next);
      if (next.progress.nextAction === "result") {
        await restorePendingResult(next);
        router.replace("/result");
        return;
      }
      if (
        next.progress.nextAction === "select_music" ||
        next.progress.nextAction === "experience" ||
        next.progress.nextAction === "complete"
      ) {
        if (next.progress.nextAction === "complete") {
          sessionStorage.setItem("integratedQuestionnairesComplete", studySessionId);
        }
        router.replace(nextRoute(next));
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "问卷加载失败");
    } finally {
      setLoading(false);
    }
  }, [applyPayload, restorePendingResult, router, studySessionId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const save = useCallback(async (nextAnswers: QuestionnaireAnswers) => {
    if (!step) return;
    try {
      await saveQuestionnaireAnswers({
        studySessionId,
        responseKey: step.key,
        answers: nextAnswers,
        complete: false,
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "问卷暂存失败");
      throw saveError;
    }
  }, [step, studySessionId]);

  const complete = useCallback(async (nextAnswers: QuestionnaireAnswers) => {
    if (!step) return;
    setError("");
    try {
      const next = await saveQuestionnaireAnswers({
        studySessionId,
        responseKey: step.key,
        answers: nextAnswers,
        complete: true,
      });
      applyPayload(next);
      if (next.progress.nextAction === "wait_baseline") {
        void startEligibleBaselines(next);
        return;
      }
      if (next.progress.nextAction === "complete") {
        sessionStorage.setItem("integratedQuestionnairesComplete", studySessionId);
      }
      if (next.progress.nextAction === "result") {
        await restorePendingResult(next);
        router.replace("/result");
      } else if (next.progress.nextAction !== "questionnaire") {
        router.replace(nextRoute(next));
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "问卷提交失败");
      throw submitError;
    }
  }, [applyPayload, restorePendingResult, router, startEligibleBaselines, step, studySessionId]);

  useEffect(() => {
    if (payload?.progress.nextAction !== "wait_baseline") return;
    void startEligibleBaselines(payload);
    const timer = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(timer);
  }, [load, payload, startEligibleBaselines]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#18141d] text-[#ffe1b5]">
        <p className="text-sm">{language === "zh" ? "正在恢复实验进度…" : "Restoring study progress..."}</p>
      </main>
    );
  }

  if (!payload) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#18141d] px-6 text-[#ffe1b5]">
        <section className="w-full max-w-xl border border-[#a77b57]/48 bg-[#211c27] p-8 text-center">
          <h1 className="font-serif text-2xl font-semibold">
            {language === "zh" ? "实验进度加载失败" : "Could not load study progress"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#efb6a5]">
            {error || (language === "zh" ? "请重新加载，已提交的数据不会被清除。" : "Reload the study. Submitted data will remain saved.")}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setError("");
                void load();
              }}
              className="h-11 border border-[#ffd083]/70 bg-[#4b3444] px-5 text-sm font-semibold hover:bg-[#5a3b4d]"
            >
              {language === "zh" ? "重新加载" : "Reload"}
            </button>
            <button
              type="button"
              onClick={() => router.replace("/?study=1")}
              className="h-11 border border-[#a77b57]/48 px-5 text-sm hover:bg-[#332832]"
            >
              {language === "zh" ? "返回实验入口" : "Return to study"}
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (payload.progress.nextAction === "wait_baseline") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#18141d] px-6 text-[#ffe1b5]">
        <section className="w-full max-w-xl border border-[#a77b57]/48 bg-[#211c27] p-8 text-center">
          <span className="mx-auto block h-10 w-10 animate-spin rounded-full border border-[#a97950]/42 border-t-[#ffd083]" />
          <h1 className="mt-5 font-serif text-2xl font-semibold">
            {language === "zh" ? "正在准备参照作品" : "Preparing the reference artwork"}
          </h1>
          <p className="mt-2 text-sm text-[#cdb297]">
            {language === "zh" ? "完成后将自动继续" : "The study will continue automatically when it is ready"}
          </p>
          {error && (
            <button
              type="button"
              onClick={() => {
                baselineStarted.current.clear();
                setError("");
                void startEligibleBaselines(payload);
              }}
              className="mt-6 h-11 border border-[#d29a6d]/48 px-5 text-sm hover:bg-[#4b3444]"
            >
              {language === "zh" ? "重试生成" : "Retry generation"}
            </button>
          )}
          {error && <p className="mt-4 text-sm text-[#efb6a5]">{error}</p>}
        </section>
      </main>
    );
  }

  if (!step || !definition) return null;

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-[#18141d] text-[#ffe1b5]">
      <div className="shrink-0 px-5 pt-4 lg:px-7">
        <FlowHeader
          activeStep={4}
          studyStage={step.scope === "pre_study"
            ? "preparation"
            : step.period === 2 ? "experience_2" : "experience_1"}
        />
      </div>
      <div className="mx-auto flex min-h-0 w-full max-w-[1180px] flex-1 flex-col px-5 pb-5 pt-3 lg:px-7">
        <header className="mb-3 flex shrink-0 items-center justify-between border-b border-[#a77b57]/32 pb-3">
          <p className="text-sm font-medium text-[#d6b28c]">
            {language === "zh" ? "问卷" : "Questionnaire"} {step.sequenceIndex}/{step.sequenceTotal}
          </p>
          <span className="text-xs text-[#9e8168]">
            {language === "zh" ? "参与者" : "Participant"} {payload.participantId}
          </span>
        </header>
        <section className="min-h-0 flex-1 overflow-hidden border border-[#a77b57]/42 bg-[#f7f5ef] shadow-[0_20px_70px_rgba(0,0,0,0.28)]">
          <QuestionnaireFlow
            key={step.key}
            definition={definition}
            answers={answers}
            language={language}
            media={step.imageUrl ? {
              src: step.imageUrl,
              alt: step.imageLabel || "待评价作品",
              label: step.imageLabel || "待评价作品",
            } : undefined}
            onAnswersChange={setAnswers}
            onSave={save}
            onComplete={complete}
          />
        </section>
        {error && <p className="mt-2 shrink-0 text-center text-sm text-[#efb6a5]">{error}</p>}
      </div>
    </main>
  );
}
