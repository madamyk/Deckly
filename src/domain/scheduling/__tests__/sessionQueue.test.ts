import type { Card } from '@/domain/models';
import {
  clampAgainReinsertAfterCards,
  clampDailyReviewLimit,
  clampNewCardsPerSession,
  pickDueCardsForQueue,
  upsertReinforcementCard,
} from '@/domain/scheduling/sessionQueue';

const NOW = 1_700_000_000_000;

function makeCard(id: string, state: Card['state']): Card {
  return {
    id,
    deckId: 'd1',
    front: `f-${id}`,
    back: `b-${id}`,
    exampleL1: null,
    exampleL2: null,
    exampleNote: null,
    exampleSource: null,
    exampleGeneratedAt: null,
    state,
    dueAt: NOW,
    intervalDays: 0,
    ease: 2.5,
    reps: 0,
    lapses: 0,
    learningStepIndex: 0,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
  };
}

describe('sessionQueue', () => {
  test('pickDueCardsForQueue prioritizes learning/review before new and caps new cards', () => {
    const due = [
      makeCard('n1', 'new'),
      makeCard('l1', 'learning'),
      makeCard('r1', 'review'),
      makeCard('n2', 'new'),
      makeCard('n3', 'new'),
    ];
    const out = pickDueCardsForQueue({
      dueCards: due,
      queuedIds: new Set(),
      reviewedIds: new Set(),
      introducedNewCount: 0,
      newCardsPerSession: 2,
    });

    expect(out.picked.map((c) => c.id)).toEqual(['l1', 'r1', 'n1', 'n2']);
    expect(out.introducedNewCount).toBe(2);
  });

  test('pickDueCardsForQueue respects maxCardsToPick', () => {
    const due = [makeCard('l1', 'learning'), makeCard('r1', 'review'), makeCard('n1', 'new')];
    const out = pickDueCardsForQueue({
      dueCards: due,
      queuedIds: new Set(),
      reviewedIds: new Set(),
      introducedNewCount: 0,
      newCardsPerSession: 10,
      maxCardsToPick: 2,
    });
    expect(out.picked.map((c) => c.id)).toEqual(['l1', 'r1']);
    expect(out.introducedNewCount).toBe(0);
  });

  test('upsertReinforcementCard inserts a failed card a few cards later', () => {
    const queue = [makeCard('a', 'new'), makeCard('b', 'new'), makeCard('c', 'new')];
    const out = upsertReinforcementCard({
      queue,
      afterIndex: 0,
      card: makeCard('a', 'learning'),
      afterCards: 2,
    });
    expect(out.map((c) => c.id)).toEqual(['a', 'b', 'c', 'a']);
  });

  test('clamp helpers bound out-of-range values', () => {
    expect(clampNewCardsPerSession(-5)).toBe(0);
    expect(clampAgainReinsertAfterCards(999)).toBe(20);
    expect(clampDailyReviewLimit(-1)).toBe(0);
  });
});
