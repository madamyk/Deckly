import type { Card } from '@/domain/models';
import {
  flipReviewDirection,
  pickReviewDirection,
  toReviewQueueItems,
} from '@/domain/scheduling/reviewDirection';

const NOW = 1_700_000_000_000;

function makeCard(id: string, state: Card['state']): Card {
  return {
    id,
    deckId: 'd1',
    front: `f-${id}`,
    back: `b-${id}`,
    exampleFront: null,
    exampleBack: null,
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
    forwardSeen: 0,
    forwardPassed: 0,
    reverseSeen: 0,
    reversePassed: 0,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
  };
}

describe('reviewDirection', () => {
  test('flipReviewDirection swaps directions', () => {
    expect(flipReviewDirection('forward')).toBe('reverse');
    expect(flipReviewDirection('reverse')).toBe('forward');
  });

  test('non-review cards keep the preferred direction', () => {
    expect(pickReviewDirection(makeCard('n1', 'new'), 25, 0)).toBe('forward');
    expect(pickReviewDirection(makeCard('l1', 'learning'), 50, 0)).toBe('forward');
  });

  test('review cards flip when random value falls below the reverse rate', () => {
    expect(pickReviewDirection(makeCard('r1', 'review'), 25, 0.1)).toBe('reverse');
    expect(pickReviewDirection(makeCard('r2', 'review'), 25, 0.9)).toBe('forward');
  });

  test('100% reverse applies to all card states', () => {
    expect(pickReviewDirection(makeCard('n1', 'new'), 100, 0.9)).toBe('reverse');
    expect(pickReviewDirection(makeCard('l1', 'learning'), 100, 0.9)).toBe('reverse');
    expect(pickReviewDirection(makeCard('r1', 'review'), 100, 0.9)).toBe('reverse');
  });

  test('toReviewQueueItems assigns direction once per queued card', () => {
    const items = toReviewQueueItems(
      [makeCard('r1', 'review'), makeCard('n1', 'new'), makeCard('l1', 'learning')],
      25,
      () => 0.1,
    );

    expect(items).toEqual([
      {
        id: 'r1',
        card: expect.objectContaining({ id: 'r1' }),
        direction: 'reverse',
      },
      {
        id: 'n1',
        card: expect.objectContaining({ id: 'n1' }),
        direction: 'forward',
      },
      {
        id: 'l1',
        card: expect.objectContaining({ id: 'l1' }),
        direction: 'forward',
      },
    ]);
  });
});
