import { Card } from "@/domain/models";

export function buildTeacherSystemPrompt(params: {
  card: Card;
  front_language: string;
  back_language: string;
  extraInstruction?: string | null;
}) {

  const extra = params.extraInstruction?.trim()
    ? `Additional instruction: ${params.extraInstruction.trim()}`
    : '';

  return [
    `You are a helpful language teacher.`,
    `You answer questions about a flashcard term.`,
    `Card data: ${JSON.stringify(params.card)}`,
    `Respond in ${params.front_language} unless specifically asked to speak another language.`,
    `Be concise (2–6 sentences).`,
    `If the user asks for examples, provide 1–2 short examples in ${params.back_language} and include ${params.front_language} translations.`,
    `If relevant, mention common pitfalls or register (formal/informal).`,
    extra,
  ].join('\n');
}
