const MAX_CHARS = 120;

export function buildTermTranslationPrompt(params: {
  sourceText: string;
  targetLanguage: string;
  sourceLanguage?: string | null;
}): string {
  const sourceText = params.sourceText.trim();
  const targetLanguage = params.targetLanguage.trim();
  const sourceLanguage = params.sourceLanguage?.trim() || '';

  return [
    `Translate a flashcard term into a dictionary-style entry.`,
    ``,
    `source_text: ${sourceText}`,
    sourceLanguage ? `source_language: ${sourceLanguage}` : null,
    `target_language: ${targetLanguage}`,
    ``,
    `Constraints:`,
    `- Return ONE word or short phrase (aim 1–3 words, max 4).`,
    `- Match the part of speech and meaning as closely as possible.`,
    `- If the source is a phrase, keep it a short phrase; if a single word, keep it a single word.`,
    `- If the result is a noun and the target language uses articles (e.g., Spanish, German), include the appropriate article (e.g., "el/la", "der/die/das").`,
    `- Avoid full sentences, punctuation, or extra commentary.`,
    `- Choose the most common dictionary sense if ambiguous.`,
    ``,
    `Return STRICT JSON ONLY with key: translation.`,
  ]
    .filter((x): x is string => typeof x === 'string')
    .join('\n');
}

export function parseAndValidateTermTranslationJSON(text: string): string {
  let obj: any;
  try {
    obj = JSON.parse(text.trim());
  } catch {
    throw new Error('AI returned invalid JSON.');
  }
  if (!obj || typeof obj !== 'object') throw new Error('AI returned invalid JSON.');
  const translation = typeof obj.translation === 'string' ? obj.translation.trim() : '';
  if (!translation) throw new Error('AI returned empty translation.');
  if (translation.length > MAX_CHARS) throw new Error('Translation is too long.');
  return translation;
}
