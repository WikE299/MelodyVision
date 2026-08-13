import type {
  QuestionnaireAnswers,
  QuestionnaireDefinition,
  QuestionnaireQuestion,
} from "./types.ts";

function sampleValue(question: QuestionnaireQuestion, index: number) {
  if (question.kind === "scale") {
    const values = [];
    for (let value = question.min; value <= question.max; value += question.step) values.push(value);
    return values[Math.min(values.length - 1, Math.max(0, Math.floor(values.length * 0.7) + (index % 2)))] ?? question.min;
  }
  if (question.kind === "choice") return question.options[index % question.options.length]?.value || "";
  if (question.kind === "pair") return index % 2 === 0 ? question.left.value : question.right.value;
  if (question.kind === "number") return Math.min(question.max, question.min + question.step * (index + 2));
  return question.multiline ? "音乐让我想到一片逐渐亮起的开阔空间。" : "视觉设计";
}

export function createCompleteAnswers(definition: QuestionnaireDefinition): QuestionnaireAnswers {
  return Object.fromEntries(
    definition.questions.map((question, index) => [question.id, sampleValue(question, index)])
  );
}

export function createPartialAnswers(definition: QuestionnaireDefinition): QuestionnaireAnswers {
  return Object.fromEntries(
    definition.questions
      .slice(0, Math.max(1, Math.floor(definition.questions.length / 2)))
      .map((question, index) => [question.id, sampleValue(question, index)])
  );
}
