import type { Card } from '@/domain/models';

export type ReviewDirection = 'forward' | 'reverse';

export type ReviewQueueItem = {
  id: string;
  card: Card;
  direction: ReviewDirection;
};

export function flipReviewDirection(direction: ReviewDirection): ReviewDirection {
  return direction === 'forward' ? 'reverse' : 'forward';
}

export function pickReviewDirection(
  card: Card,
  reverseRate: number,
  randomValue = Math.random(),
): ReviewDirection {
  if (reverseRate >= 100) return 'reverse';
  if (reverseRate <= 0) return 'forward';
  if (card.state !== 'review') return 'forward';
  return randomValue < reverseRate / 100 ? 'reverse' : 'forward';
}

export function toReviewQueueItems(
  cards: Card[],
  reverseRate: number,
  randomValue: () => number = Math.random,
): ReviewQueueItem[] {
  return cards.map((card) => ({
    id: card.id,
    card,
    direction: pickReviewDirection(card, reverseRate, randomValue()),
  }));
}
