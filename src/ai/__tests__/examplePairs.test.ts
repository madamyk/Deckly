import { applyExampleToCardPatch, buildExamplePrompt, parseAndValidateExampleJSON } from '@/ai/examplePairs';

describe('buildExamplePrompt()', () => {
  test('includes required variables and constraints', () => {
    const p = buildExamplePrompt({
      frontText: 'correr',
      backText: 'to run',
      front_language: 'Spanish',
      back_language: 'English',
      level: 'medium',
    });

    expect(p).toContain('front_language: Spanish');
    expect(p).toContain('back_language: English');
    expect(p).toContain('front_term: correr');
    expect(p).toContain('back_term: to run');
    expect(p).toContain('Keep each sentence');
    expect(p).toContain('Return STRICT JSON ONLY');
  });

  test('includes seed instructions when one side is provided', () => {
    const p = buildExamplePrompt({
      frontText: 'correr',
      backText: 'to run',
      front_language: 'Spanish',
      back_language: 'English',
      level: 'medium',
      seedExampleFront: 'Yo corro hoy.',
      seedExampleBack: null,
    });
    expect(p).toContain('Provided Example front');
    expect(p).toContain('keep EXACTLY');
    expect(p).toContain('Task: translate it into English');
  });
});

describe('parseAndValidateExampleJSON()', () => {
  test('parses valid JSON and trims values', () => {
    const out = parseAndValidateExampleJSON(
      JSON.stringify({
        example_front: '  Yo corro al parque cada manana  ',
        example_back: '  I run to the park every morning  ',
        note: '  ',
      }),
    );
    expect(out.exampleFront).toBe('Yo corro al parque cada manana');
    expect(out.exampleBack).toBe('I run to the park every morning');
    expect(out.note).toBe('');
  });

  test('rejects invalid shapes', () => {
    expect(() => parseAndValidateExampleJSON('not json')).toThrow(/JSON/i);
    expect(() => parseAndValidateExampleJSON(JSON.stringify({}))).toThrow(/empty/i);
  });

  test('keeps the seeded side even if the model rewrites it', () => {
    const seedL1 = 'Yo corro.';
    const out = parseAndValidateExampleJSON(
      JSON.stringify({
        example_front: 'Yo corro hoy.',
        example_back: 'I run to the park every morning',
        note: '',
      }),
      { seedExampleFront: seedL1, seedExampleBack: null },
    );
    expect(out.exampleFront).toBe(seedL1);
  });

  test('rejects when keys are missing', () => {
    expect(() => parseAndValidateExampleJSON(JSON.stringify({ note: '' }))).toThrow(/empty/i);
  });
});

describe('applyExampleToCardPatch()', () => {
  test('sets ai source and timestamps', () => {
    const patch = applyExampleToCardPatch(
      { exampleFront: 'Yo corro al parque cada manana', exampleBack: 'I run to the park every morning', note: '' },
      { source: 'ai', now: 123 },
    );
    expect(patch.exampleSource).toBe('ai');
    expect(patch.exampleGeneratedAt).toBe(123);
    expect(patch.exampleNote).toBeNull();
  });
});
