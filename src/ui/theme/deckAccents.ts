export type DeckAccent = {
  key: string; // stored in DB
  label: string;
  color: string;
};

// A small, curated set that works in both light/dark themes.
export const DECK_ACCENTS: DeckAccent[] = [
  // 8 distinct accents (avoid multiple "violet-ish" options).
  { key: 'violet', label: 'Violet', color: '#7C5CFF' },
  // Single "green-ish" option.
  { key: 'teal', label: 'Teal', color: '#14B8A6' },
  { key: 'sky', label: 'Sky', color: '#0EA5E9' },
  { key: 'cobalt', label: 'Cobalt', color: '#2563EB' },
  { key: 'amber', label: 'Amber', color: '#F59E0B' },
  { key: 'orange', label: 'Orange', color: '#F97316' },
  { key: 'rose', label: 'Rose', color: '#F43F5E' },
];

export function resolveDeckAccentColor(key: string | null | undefined): string | null {
  if (!key) return null;
  const found = DECK_ACCENTS.find((a) => a.key === key);
  return found?.color ?? null;
}
