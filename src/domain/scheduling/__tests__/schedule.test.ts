import type { Card } from '@/domain/models';
import { schedule } from '@/domain/scheduling/schedule';

const NOW = 1_700_000_000_000;

function baseCard(overrides: Partial<Card>): Card {
  return {
    id: 'c1',
    deckId: 'd1',
    front: 'front',
    back: 'back',
    exampleFront: null,
    exampleBack: null,
    exampleNote: null,
    exampleSource: null,
    exampleGeneratedAt: null,
    state: 'new',
    dueAt: NOW,
    intervalDays: 0,
    ease: 2.5,
    reps: 0,
    lapses: 0,
    learningStepIndex: 0,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    ...overrides,
  };
}

describe('schedule()', () => {
  test('new + again -> learning step 0', () => {
    const c = baseCard({ state: 'new' });
    const p = schedule(c, 'again', NOW);
    expect(p.state).toBe('learning');
    expect(p.learningStepIndex).toBe(0);
    expect(p.dueAt).toBeGreaterThan(NOW);
    expect(p.intervalDays).toBe(0);
    expect(p.ease).toBe(2.5);
    expect(p.reps).toBe(1);
  });

  test('new + good -> learning step 1', () => {
    const c = baseCard({ state: 'new' });
    const p = schedule(c, 'good', NOW);
    expect(p.state).toBe('learning');
    expect(p.learningStepIndex).toBe(1);
    expect(p.dueAt).toBeGreaterThan(NOW);
  });

  test('new + easy -> review graduate', () => {
    const c = baseCard({ state: 'new' });
    const p = schedule(c, 'easy', NOW);
    expect(p.state).toBe('review');
    expect(p.intervalDays).toBe(2);
    expect(p.ease).toBe(2.5);
    expect(p.dueAt).toBeGreaterThan(NOW);
  });

  test('learning + hard repeats current step', () => {
    const c = baseCard({ state: 'learning', learningStepIndex: 1 });
    const p = schedule(c, 'hard', NOW);
    expect(p.state).toBe('learning');
    expect(p.learningStepIndex).toBe(1);
    expect(p.dueAt).toBeGreaterThan(NOW);
  });

  test('learning + good graduates after last step', () => {
    const c = baseCard({ state: 'learning', learningStepIndex: 2 });
    const p = schedule(c, 'good', NOW);
    expect(p.state).toBe('review');
    expect(p.intervalDays).toBe(2);
  });

  test('review + again lapses into learning and decreases ease (min 1.3)', () => {
    const c = baseCard({ state: 'review', intervalDays: 10, ease: 1.3, lapses: 2 });
    const p = schedule(c, 'again', NOW);
    expect(p.state).toBe('learning');
    expect(p.learningStepIndex).toBe(0);
    expect(p.lapses).toBe(3);
    expect(p.ease).toBe(1.3);
  });

  test('review + hard decreases ease and increases interval modestly', () => {
    const c = baseCard({ state: 'review', intervalDays: 10, ease: 2.5 });
    const p = schedule(c, 'hard', NOW);
    expect(p.state).toBe('review');
    expect(p.ease).toBeCloseTo(2.35);
    expect(p.intervalDays).toBeGreaterThanOrEqual(10);
  });

  test('review + good uses interval * ease', () => {
    const c = baseCard({ state: 'review', intervalDays: 10, ease: 2.5 });
    const p = schedule(c, 'good', NOW);
    expect(p.intervalDays).toBe(25);
  });

  test('review + easy increases ease (max 3.0) and boosts interval', () => {
    const c = baseCard({ state: 'review', intervalDays: 10, ease: 3.0 });
    const p = schedule(c, 'easy', NOW);
    expect(p.ease).toBe(3.0);
    expect(p.intervalDays).toBeGreaterThan(10);
  });
});
