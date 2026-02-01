import type { Card, ExampleSource } from '@/domain/models';
import type { AiExampleDomain, AiExampleLevel } from '@/domain/prefs';
import { nowMs } from '@/utils/time';

export type ExamplePair = {
  exampleFront: string;
  exampleBack: string;
  note: string; // may be empty
};

// Keep validation light: we mostly want to avoid empty / runaway outputs.
const MAX_CHARS = 600;

export function buildExamplePrompt(params: {
  frontText: string;
  backText: string;
  front_language: string;
  back_language: string;
  level: AiExampleLevel;
  domain: AiExampleDomain;
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
    `- Translation quality: example_front and example_back MUST be the best possible natural translations of each other.`,
    `  - Preserve meaning, tense, and intent; avoid literal word-for-word translation if it sounds unnatural.`,
    `  - If there is any ambiguity, use back_term to disambiguate meaning.`,
    `  - Before responding, verify both sentences match meaning closely.`,
    `- Avoid idioms/slang/rare words.`,
    seedFront ? `- example_front is provided; do not rewrite it.` : null,
    seedBack ? `- example_back is provided; do not rewrite it.` : null,
    seedFront || seedBack ? `- Generate the missing sentence as a 1-sentence translation.` : `- Keep each sentence to 1 sentence.`,
    `- Difficulty: ${params.level} (medium complexity).`,
    `- Domain/context: ${params.domain}.`,
    `- NOTE field rules (important):`,
    `  - note must be written in ${frontLang} ONLY (repeat: use ${frontLang}).`,
    `  - keep note brief (1 short sentence).`,
    `  - note must describe ONLY the back_term (in ${backLang}): usage, ambiguity, regional nuance, false friends, common pitfalls.`,
    `  - do NOT define the front_term. Do NOT explain the English word; explain the ${backLang} term instead.`,
    `  - you may briefly compare to the front_term to clarify the pitfall, but the subject must remain the back_term.`,
    `  - if back_term can be vulgar/offensive/slangy in any region or has a vulgar alternative meaning, mention that briefly; otherwise do not mention vulgarity at all.`,
    `  - verify note language is ${frontLang} before responding.`,
    `  - if there is no useful warning, return note as an empty string.`,
    ``,
    `Return STRICT JSON ONLY with keys: example_front, example_back, note.`,
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
