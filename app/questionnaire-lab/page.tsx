import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { isQuestionnaireLabRequest } from "@/lib/questionnaire-lab-access";
import QuestionnaireLabClient from "./QuestionnaireLabClient";

export const dynamic = "force-dynamic";

export default async function QuestionnaireLabPage() {
  if (!isQuestionnaireLabRequest(await headers())) notFound();
  return <QuestionnaireLabClient />;
}
