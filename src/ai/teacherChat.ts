export function buildTeacherSystemPrompt(params: {
  frontText: string;
  backText: string;
  note?: string | null;
  front_language: string;
  back_language: string;
  extraInstruction?: string | null;
}) {
  const noteLine = params.note?.trim()
    ? `Teacher note (in ${params.front_language}): "${params.note.trim()}"`
    : `Teacher note: (none).`;
  const extra = params.extraInstruction?.trim()
    ? `Additional instruction: ${params.extraInstruction.trim()}`
    : '';

  return [
    `You are a helpful language teacher.`,
    `You answer questions about a flashcard term.`,
    `Front language (learner): ${params.front_language}.`,
    `Back language (target): ${params.back_language}.`,
    `Card front term: "${params.frontText}".`,
    `Card back term: "${params.backText}".`,
    noteLine,
    `Respond in ${params.front_language}.`,
    `If an additional instruction specifies a different response language, follow it.`,
    `Be concise (2–6 sentences).`,
    `If the user asks for examples, provide 1–2 short examples in ${params.back_language} and include ${params.front_language} translations.`,
    `If relevant, mention common pitfalls or register (formal/informal).`,
    `Stay focused on this card; do not introduce unrelated topics.`,
    extra,
  ].join('\n');
}
