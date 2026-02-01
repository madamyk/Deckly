export const DECK_ACCENT_KEYS = [
  'violet',
  'teal',
  'sky',
  'cobalt',
  'amber',
  'orange',
  'rose',
] as const;

export type DeckAccentKey = (typeof DECK_ACCENT_KEYS)[number];

export function pickRandomDeckAccentKey(): DeckAccentKey {
  const i = Math.floor(Math.random() * DECK_ACCENT_KEYS.length);
  return DECK_ACCENT_KEYS[i]!;
}
