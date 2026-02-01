import { buildDetectDeckLanguagesPrompt, parseAndValidateDeckLanguagesJSON } from '@/ai/deckLanguages';

describe('buildDetectDeckLanguagesPrompt()', () => {
  test('includes mapped samples and strict JSON requirement', () => {
    const p = buildDetectDeckLanguagesPrompt({
      samples: [
        { front: 'run', back: 'correr', example_front: 'I run today.', example_back: 'Yo corro hoy.' },
        { front: 'eat', back: 'comer' },
      ],
    });
    expect(p).toContain('Samples');
    expect(p).toContain('front_language');
    expect(p).toContain('back_language');
    expect(p).toContain('Return STRICT JSON ONLY');
  });
});

describe('parseAndValidateDeckLanguagesJSON()', () => {
  test('parses and trims fields', () => {
    const out = parseAndValidateDeckLanguagesJSON(
      JSON.stringify({ front_language: ' English ', back_language: 'Spanish', confidence: 0.7 }),
    );
    expect(out.front_language).toBe('English');
    expect(out.back_language).toBe('Spanish');
    expect(out.confidence).toBeCloseTo(0.7);
  });

  test('rejects invalid shapes', () => {
    expect(() => parseAndValidateDeckLanguagesJSON('nope')).toThrow(/JSON/i);
    expect(() => parseAndValidateDeckLanguagesJSON(JSON.stringify({}))).toThrow(/Language detection/i);
  });
});

