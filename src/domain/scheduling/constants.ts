import { DAY_MS, MINUTE_MS } from '@/utils/time';

// Deckly ships an "Anki-lite" default. Later this can move to per-deck settings.
export const LEARNING_STEPS_MS = [1 * MINUTE_MS, 10 * MINUTE_MS, 1 * DAY_MS] as const;

export const DEFAULT_EASE = 2.5;
export const MIN_EASE = 1.3;
export const MAX_EASE = 3.0;

export const GRADUATING_INTERVAL_DAYS = 2;

export const DEFAULT_NEW_CARDS_PER_SESSION = 12;
export const MIN_NEW_CARDS_PER_SESSION = 0;
export const MAX_NEW_CARDS_PER_SESSION = 200;

export const DEFAULT_AGAIN_REINSERT_AFTER_CARDS = 4;
export const MIN_AGAIN_REINSERT_AFTER_CARDS = 1;
export const MAX_AGAIN_REINSERT_AFTER_CARDS = 20;

export const DEFAULT_DAILY_REVIEW_LIMIT = 60;
export const MIN_DAILY_REVIEW_LIMIT = 0;
export const MAX_DAILY_REVIEW_LIMIT = 500;
