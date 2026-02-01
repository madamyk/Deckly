import { DAY_MS, MINUTE_MS } from '@/utils/time';

// Deckly ships an "Anki-lite" default. Later this can move to per-deck settings.
export const LEARNING_STEPS_MS = [10 * MINUTE_MS, 1 * DAY_MS] as const;

export const DEFAULT_EASE = 2.5;
export const MIN_EASE = 1.3;
export const MAX_EASE = 3.0;

export const GRADUATING_INTERVAL_DAYS = 2;

