import type { Card, ExampleSource } from '@/domain/models';
import type { AiExampleLevel } from '@/domain/prefs';
import { nowMs } from '@/utils/time';

export type ExamplePair = {
  exampleFront: string;
  exampleBack: string;
  note: string; // may be empty
};

export type ExamplePairBatchItem = {
  id: string;
  frontText: string;
  backText: string;
  seedExampleFront?: string | null;
  seedExampleBack?: string | null;
};

export type ExamplePairBatchResult = {
  id: string;
  pair: ExamplePair;
};

export type ExampleBatchParseFailure = {
  id: string;
  reason: string;
};

// Keep validation light: we mostly want to avoid empty / runaway outputs.
const MAX_CHARS = 600;

export function buildExamplePrompt(params: {
  frontText: string;
  backText: string;
  front_language: string;
  back_language: string;
  level: AiExampleLevel;
  seedExampleFront?: string | null;
  seedExampleBack?: string | null;
}): string {
  const front = params.frontText.trim();
  const back = params.backText.trim();
  const seedFront = params.seedExampleFront?.trim() || '';
  const seedBack = params.seedExampleBack?.trim() || '';
  const frontLang = params.front_language.trim();
  const backLang = params.back_language.trim();

  const seedBlock: string[] = [];
  if (seedFront && !seedBack) {
    seedBlock.push(`Provided Example front (${frontLang}) — keep EXACTLY (do not rewrite):`);
    seedBlock.push(seedFront);
    seedBlock.push(``);
    seedBlock.push(`Task: translate it into ${backLang} as example_back (natural, close meaning).`);
    seedBlock.push(``);
  } else if (!seedFront && seedBack) {
    seedBlock.push(`Provided Example back (${backLang}) — keep EXACTLY (do not rewrite):`);
    seedBlock.push(seedBack);
    seedBlock.push(``);
    seedBlock.push(`Task: translate it into ${frontLang} as example_front (natural, close meaning).`);
    seedBlock.push(``);
  }

  return [
    `Generate a bilingual example sentence pair for a flashcard.`,
    ``,
    `front_language: ${frontLang}`,
    `back_language: ${backLang}`,
    `front_term: ${front}`,
    `back_term: ${back}`,
    ``,
    ...(seedBlock.length ? seedBlock : []),
    `Constraints:`,
    `- example_front MUST be in ${frontLang}.`,
    `- example_back MUST be in ${backLang}.`,
    seedFront ? null : `- Use the front_term naturally in example_front.`,
    `- Keep each example sentence short: aim for ~8–12 words (target ~10).`,
    `- Translation quality: example_front and example_back MUST be the best possible natural translations of each other.`,
    `  - Preserve meaning, tense, and intent; avoid literal word-for-word translation if it sounds unnatural.`,
    `  - If there is any ambiguity, use back_term to disambiguate meaning.`,
    `- Avoid idioms/slang/rare words.`,
    seedFront ? `- example_front is provided; do not rewrite it.` : null,
    seedBack ? `- example_back is provided; do not rewrite it.` : null,
    seedFront || seedBack ? `- Generate the missing sentence as a 1-sentence translation.` : `- Keep each sentence to 1 sentence.`,
    `- Difficulty: ${params.level} (easy/medium/advanced).`,
    `- NOTE field rules (important):`,
    `  - note must be written in ${frontLang} ONLY (repeat: use ${frontLang}).`,
    `  - keep note brief (1 short sentence).`,
    `  - note must describe ONLY the back_term (in ${backLang}): usage, ambiguity, regional nuance, false friends, common pitfalls.`,
    `  - you may briefly compare to the front_term to clarify the pitfall, but the subject must remain the back_term.`,
    `  - if back_term can be vulgar/offensive/slangy in any region or has a vulgar alternative meaning, mention that briefly; otherwise do not mention vulgarity at all.`,
    `  - ONLY include a note when there is a clear, important warning/nuance. If nothing worth mentioning, return note as an empty string.`,
    ``,
    `Return STRICT JSON ONLY with keys: example_front, example_back, note.`,
  ]
    .filter((x): x is string => typeof x === 'string')
    .join('\n');
}

export function buildExampleBatchPrompt(params: {
  items: ExamplePairBatchItem[];
  front_language: string;
  back_language: string;
  level: AiExampleLevel;
}): string {
  const frontLang = params.front_language.trim();
  const backLang = params.back_language.trim();

  const itemsBlock = params.items.flatMap((item, idx) => {
    const front = item.frontText.trim();
    const back = item.backText.trim();
    const seedFront = item.seedExampleFront?.trim() || '';
    const seedBack = item.seedExampleBack?.trim() || '';

    const seedLines: string[] = [];
    if (seedFront && !seedBack) {
      seedLines.push(`Provided Example front (${frontLang}) — keep EXACTLY (do not rewrite):`);
      seedLines.push(seedFront);
      seedLines.push(`Task: translate it into ${backLang} as example_back (natural, close meaning).`);
    } else if (!seedFront && seedBack) {
      seedLines.push(`Provided Example back (${backLang}) — keep EXACTLY (do not rewrite):`);
      seedLines.push(seedBack);
      seedLines.push(`Task: translate it into ${frontLang} as example_front (natural, close meaning).`);
    } else if (seedFront && seedBack) {
      seedLines.push(`Provided Example front (${frontLang}) — keep EXACTLY (do not rewrite):`);
      seedLines.push(seedFront);
      seedLines.push(`Provided Example back (${backLang}) — keep EXACTLY (do not rewrite):`);
      seedLines.push(seedBack);
    }

    return [
      `Item ${idx + 1}:`,
      `id: ${item.id}`,
      `front_term: ${front}`,
      `back_term: ${back}`,
      ...(seedLines.length ? seedLines : []),
      ``,
    ];
  });

  return [
    `Generate bilingual example sentence pairs for flashcards.`,
    ``,
    `front_language: ${frontLang}`,
    `back_language: ${backLang}`,
    ``,
    `Constraints (apply to EVERY item):`,
    `- example_front MUST be in ${frontLang}.`,
    `- example_back MUST be in ${backLang}.`,
    `- Use the front_term naturally in example_front (unless example_front is provided).`,
    `- Keep each example sentence short: aim for ~8–12 words (target ~10).`,
    `- Translation quality: example_front and example_back MUST be the best possible natural translations of each other.`,
    `  - Preserve meaning, tense, and intent; avoid literal word-for-word translation if it sounds unnatural.`,
    `  - If there is any ambiguity, use back_term to disambiguate meaning.`,
    `  - Before responding, verify both sentences match meaning closely.`,
    `- Avoid idioms/slang/rare words.`,
    `- Difficulty: ${params.level} (easy/medium/advanced).`,
    `- NOTE field rules (important):`,
    `  - note must be written in ${frontLang} ONLY (repeat: use ${frontLang}).`,
    `  - keep note brief (1 short sentence).`,
    `  - note must describe ONLY the back_term (in ${backLang}): usage, ambiguity, regional nuance, false friends, common pitfalls.`,
    `  - do NOT define the front_term. Do NOT explain the English word; explain the ${backLang} term instead.`,
    `  - you may briefly compare to the front_term to clarify the pitfall, but the subject must remain the back_term.`,
    `  - if back_term can be vulgar/offensive/slangy in any region or has a vulgar alternative meaning, mention that briefly; otherwise do not mention vulgarity at all.`,
    `  - verify note language is ${frontLang} before responding.`,
    `  - ONLY include a note when there is a clear, important warning/nuance. If nothing worth mentioning, return note as an empty string.`,
    ``,
    `Items:`,
    ...itemsBlock,
    `Return STRICT JSON ONLY with key "items":`,
    `items: [{ id, example_front, example_back, note }]`,
    `Keep the id values EXACTLY as provided.`,
  ]
    .filter((x): x is string => typeof x === 'string')
    .join('\n');
}

export function parseAndValidateExampleJSON(
  text: string,
  opts?: {
    seedExampleFront?: string | null;
    seedExampleBack?: string | null;
  },
): ExamplePair {
  let obj: any;
  try {
    obj = JSON.parse(text.trim());
  } catch {
    throw new Error('AI returned invalid JSON.');
  }

  if (!obj || typeof obj !== 'object') throw new Error('AI returned invalid JSON.');
  const exFrontRaw = typeof obj.example_front === 'string' ? obj.example_front.trim() : '';
  const exBackRaw = typeof obj.example_back === 'string' ? obj.example_back.trim() : '';
  const note = typeof obj.note === 'string' ? obj.note.trim() : '';

  const seedFront = opts?.seedExampleFront?.trim() || '';
  const seedBack = opts?.seedExampleBack?.trim() || '';

  // In "missing" mode we may seed one side from CSV/user input. Keep the seeded value.
  const exampleFront = seedFront || exFrontRaw;
  const exampleBack = seedBack || exBackRaw;

  if (!exampleFront || !exampleBack) throw new Error('AI returned empty example(s).');
  if (exampleFront.length > MAX_CHARS) throw new Error('example_front is too long.');
  if (exampleBack.length > MAX_CHARS) throw new Error('example_back is too long.');

  return { exampleFront, exampleBack, note };
}

export function parseAndValidateExampleBatchJSON(
  text: string,
  opts?: {
    seedById?: Record<string, { seedExampleFront?: string | null; seedExampleBack?: string | null }>;
    expectedIds?: string[];
  },
): { pairs: ExamplePairBatchResult[]; failures: ExampleBatchParseFailure[] } {
  let obj: any;
  try {
    obj = JSON.parse(text.trim());
  } catch {
    throw new Error('AI returned invalid JSON.');
  }

  const items: any[] = Array.isArray(obj?.items) ? obj.items : Array.isArray(obj) ? obj : [];
  if (!Array.isArray(items)) {
    throw new Error('AI returned invalid JSON.');
  }

  const pairs: ExamplePairBatchResult[] = [];
  const failures: ExampleBatchParseFailure[] = [];
  const seen = new Set<string>();

  for (const raw of items) {
    const id = typeof raw?.id === 'string' ? raw.id.trim() : '';
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);

    const exFrontRaw = typeof raw?.example_front === 'string' ? raw.example_front.trim() : '';
    const exBackRaw = typeof raw?.example_back === 'string' ? raw.example_back.trim() : '';
    const note = typeof raw?.note === 'string' ? raw.note.trim() : '';

    const seed = opts?.seedById?.[id];
    const seedFront = seed?.seedExampleFront?.trim() || '';
    const seedBack = seed?.seedExampleBack?.trim() || '';

    const exampleFront = seedFront || exFrontRaw;
    const exampleBack = seedBack || exBackRaw;

    if (!exampleFront || !exampleBack) {
      failures.push({ id, reason: 'AI returned empty example(s).' });
      continue;
    }
    if (exampleFront.length > MAX_CHARS) {
      failures.push({ id, reason: 'example_front is too long.' });
      continue;
    }
    if (exampleBack.length > MAX_CHARS) {
      failures.push({ id, reason: 'example_back is too long.' });
      continue;
    }

    pairs.push({ id, pair: { exampleFront, exampleBack, note } });
  }

  if (opts?.expectedIds?.length) {
    for (const id of opts.expectedIds) {
      if (seen.has(id)) continue;
      failures.push({ id, reason: 'AI response was missing this item.' });
    }
  }

  return { pairs, failures };
}

export function applyExampleToCardPatch(
  pair: ExamplePair,
  params?: { source?: ExampleSource; now?: number },
): Partial<Pick<Card, 'exampleL1' | 'exampleL2' | 'exampleNote' | 'exampleSource' | 'exampleGeneratedAt'>> {
  const source = params?.source ?? 'ai';
  const now = params?.now ?? nowMs();
  return {
    exampleL1: pair.exampleFront,
    exampleL2: pair.exampleBack,
    exampleNote: pair.note ? pair.note : null,
    exampleSource: source,
    exampleGeneratedAt: source === 'ai' ? now : null,
  };
}
