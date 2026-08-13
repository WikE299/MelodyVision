import type {
  QuestionnaireAnswers,
  QuestionnaireResponse,
  StudyQuestionnaireProgress,
} from "./questionnaires";

export interface QuestionnaireProgressPayload {
  participantId: string;
  progress: StudyQuestionnaireProgress;
  response?: QuestionnaireResponse;
  saved?: boolean;
}

async function parseResponse(response: Response): Promise<QuestionnaireProgressPayload> {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Questionnaire request failed");
  return data as QuestionnaireProgressPayload;
}

export async function fetchQuestionnaireProgress(
  studySessionId: string
): Promise<QuestionnaireProgressPayload> {
  return parseResponse(await fetch(
    `/api/experiment/questionnaire?studySessionId=${encodeURIComponent(studySessionId)}`,
    { cache: "no-store" }
  ));
}

export async function saveQuestionnaireAnswers(input: {
  studySessionId: string;
  responseKey: string;
  answers: QuestionnaireAnswers;
  complete: boolean;
}): Promise<QuestionnaireProgressPayload> {
  return parseResponse(await fetch("/api/experiment/questionnaire", {
    method: input.complete ? "POST" : "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }));
}
