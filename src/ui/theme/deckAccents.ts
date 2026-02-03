import type { DecklyScheme } from '@/ui/theme/tokens';

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
  { key: 'lime', label: 'Lime', color: '#84CC16' },
  { key: 'amber', label: 'Amber', color: '#F59E0B' },
  { key: 'orange', label: 'Orange', color: '#F97316' },
  { key: 'rose', label: 'Rose', color: '#F43F5E' },
];

export function resolveDeckAccentColor(key: string | null | undefined): string | null {
  if (!key) return null;
  const found = DECK_ACCENTS.find((a) => a.key === key);
  return found?.color ?? null;
}

function clamp(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function mixHex(a: string, b: string, amount: number): string {
  const parse = (hex: string) => {
    const h = hex.replace('#', '');
    if (h.length !== 6) return { r: 0, g: 0, b: 0 };
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  };
  const ca = parse(a);
  const cb = parse(b);
  const t = Math.max(0, Math.min(1, amount));
  const r = clamp(ca.r + (cb.r - ca.r) * t);
  const g = clamp(ca.g + (cb.g - ca.g) * t);
  const bch = clamp(ca.b + (cb.b - ca.b) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bch
    .toString(16)
    .padStart(2, '0')}`;
}

export function getDeckAccentGradient(color: string, scheme: DecklyScheme): [string, string] {
  const darker = mixHex(color, '#000000', scheme === 'dark' ? 0.1 : 0.08);
  const lighter = mixHex(color, '#FFFFFF', scheme === 'dark' ? 0.08 : 0.12);
  return [darker, lighter];
}
