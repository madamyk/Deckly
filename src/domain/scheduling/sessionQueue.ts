import type { Card } from '@/domain/models';
import {
  DEFAULT_AGAIN_REINSERT_AFTER_CARDS,
  DEFAULT_DAILY_REVIEW_LIMIT,
  DEFAULT_NEW_CARDS_PER_SESSION,
  MAX_AGAIN_REINSERT_AFTER_CARDS,
  MAX_DAILY_REVIEW_LIMIT,
  MAX_NEW_CARDS_PER_SESSION,
  MIN_AGAIN_REINSERT_AFTER_CARDS,
  MIN_DAILY_REVIEW_LIMIT,
  MIN_NEW_CARDS_PER_SESSION,
} from '@/domain/scheduling/constants';

function clampInt(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function clampNewCardsPerSession(value: number): number {
  return clampInt(
    value,
    MIN_NEW_CARDS_PER_SESSION,
    MAX_NEW_CARDS_PER_SESSION,
    DEFAULT_NEW_CARDS_PER_SESSION,
  );
}

export function clampAgainReinsertAfterCards(value: number): number {
  return clampInt(
    value,
    MIN_AGAIN_REINSERT_AFTER_CARDS,
    MAX_AGAIN_REINSERT_AFTER_CARDS,
    DEFAULT_AGAIN_REINSERT_AFTER_CARDS,
  );
}

export function clampDailyReviewLimit(value: number): number {
  return clampInt(
    value,
    MIN_DAILY_REVIEW_LIMIT,
    MAX_DAILY_REVIEW_LIMIT,
    DEFAULT_DAILY_REVIEW_LIMIT,
  );
}

export function pickDueCardsForQueue(params: {
  dueCards: Card[];
  queuedIds: Set<string>;
  reviewedIds: Set<string>;
  introducedNewCount: number;
  newCardsPerSession: number;
  maxCardsToPick?: number;
}): { picked: Card[]; introducedNewCount: number } {
  const filtered = params.dueCards.filter(
    (card) => !params.queuedIds.has(card.id) && !params.reviewedIds.has(card.id),
  );
  const learning = filtered.filter((card) => card.state === 'learning');
  const review = filtered.filter((card) => card.state === 'review');
  const fresh = filtered.filter((card) => card.state === 'new');

  const limit = clampNewCardsPerSession(params.newCardsPerSession);
  const allowance = Math.max(0, limit - params.introducedNewCount);
  const newCards = fresh.slice(0, allowance);
  const picked = [...learning, ...review, ...newCards];
  const boundedPicked =
    typeof params.maxCardsToPick === 'number' && Number.isFinite(params.maxCardsToPick)
      ? picked.slice(0, Math.max(0, Math.floor(params.maxCardsToPick)))
      : picked;
  const boundedNewCards = boundedPicked.filter((card) => card.state === 'new').length;

  return {
    picked: boundedPicked,
    introducedNewCount: params.introducedNewCount + boundedNewCards,
  };
}

export function upsertReinforcementCard(params: {
  queue: Card[];
  afterIndex: number;
  card: Card;
  afterCards: number;
}): Card[] {
  const next = [...params.queue];
  const existingIndex = next.findIndex(
    (candidate, idx) => idx > params.afterIndex && candidate.id === params.card.id,
  );

  if (existingIndex >= 0) {
    next[existingIndex] = params.card;
    return next;
  }

  const gap = clampAgainReinsertAfterCards(params.afterCards);
  const insertAt = Math.min(params.afterIndex + gap + 1, next.length);
  next.splice(insertAt, 0, params.card);
  return next;
}
