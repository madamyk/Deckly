export type DeckLanguages = {
  front_language: string; // e.g. "English" or "en"
  back_language: string; // e.g. "Spanish" or "es"
  confidence?: number; // 0..1 (optional)
};

function cleanLang(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.trim() : '';
  // Keep it short; it's only used as a prompt hint (not a formal locale).
  if (!s) return '';
  return s.length > 32 ? s.slice(0, 32) : s;
}

export function buildDetectDeckLanguagesPrompt(params: {
  samples: { front: string; back: string; example_front?: string | null; example_back?: string | null }[];
}): string {
  const s = params.samples.slice(0, 3).map((x, i) => ({
    i: i + 1,
    front: x.front.trim(),
    back: x.back.trim(),
    example_front: (x.example_front ?? '').trim(),
    example_back: (x.example_back ?? '').trim(),
  }));

  return [
    `We are importing flashcards.`,
    `Each card has: front (term), back (meaning), and optional example sentences.`,
    ``,
    `Samples (already mapped correctly by the user):`,
    JSON.stringify(s, null, 2),
    ``,
    `Task: infer the language used on the front side and the language used on the back side.`,
    `Return STRICT JSON ONLY with keys: front_language, back_language, confidence.`,
    `- front_language: a short name or code (e.g. "English" or "en")`,
    `- back_language: a short name or code (e.g. "Spanish" or "es")`,
    `- confidence: 0..1`,
  ].join('\n');
}

export function parseAndValidateDeckLanguagesJSON(text: string): DeckLanguages {
  let obj: any;
  try {
    obj = JSON.parse(text.trim());
  } catch {
    throw new Error('AI returned invalid JSON.');
  }
  if (!obj || typeof obj !== 'object') throw new Error('AI returned invalid JSON.');

  const front_language = cleanLang(obj.front_language);
  const back_language = cleanLang(obj.back_language);
  const confidence =
    typeof obj.confidence === 'number' && isFinite(obj.confidence)
      ? Math.max(0, Math.min(1, obj.confidence))
      : undefined;

  if (!front_language || !back_language) throw new Error('Language detection failed.');
  return { front_language, back_language, confidence };
}
