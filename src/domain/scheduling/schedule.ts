import type { Card } from '@/domain/models';
import type { Rating } from '@/domain/ratings';
import {
  DEFAULT_EASE,
  GRADUATING_INTERVAL_DAYS,
  LEARNING_STEPS_MS,
  MAX_EASE,
  MIN_EASE,
} from '@/domain/scheduling/constants';
import { DAY_MS } from '@/utils/time';

export type CardPatch = Partial<
  Pick<
    Card,
    | 'state'
    | 'dueAt'
    | 'intervalDays'
    | 'ease'
    | 'reps'
    | 'lapses'
    | 'learningStepIndex'
    | 'updatedAt'
  >
>;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function roundInt(n: number): number {
  return Math.round(n);
}

function graduateToReview(now: number, baseEase?: number): CardPatch {
  return {
    state: 'review',
    learningStepIndex: 0,
    intervalDays: GRADUATING_INTERVAL_DAYS,
    ease: baseEase ?? DEFAULT_EASE,
    dueAt: now + GRADUATING_INTERVAL_DAYS * DAY_MS,
  };
}

/**
 * Pure scheduling function (Anki-lite / SM-2-ish).
 *
 * Notes:
 * - `reps` is incremented on every rating press (including "Again").
 * - Timestamps are integer ms since epoch.
 */
export function schedule(card: Card, rating: Rating, now: number): CardPatch {
  const baseEase = typeof card.ease === 'number' ? card.ease : DEFAULT_EASE;
  const patch: CardPatch = {
    reps: (card.reps ?? 0) + 1,
    updatedAt: now,
  };

  if (card.state === 'new') {
    if (rating === 'easy') return { ...patch, ...graduateToReview(now, DEFAULT_EASE) };
    // First time seen: move into learning.
    const stepIndex =
      rating === 'good' ? 1 : 0 /* again/hard both keep the first step */;
    const stepMs = LEARNING_STEPS_MS[Math.min(stepIndex, LEARNING_STEPS_MS.length - 1)];
    return {
      ...patch,
      state: 'learning',
      learningStepIndex: stepIndex,
      dueAt: now + stepMs,
      ease: DEFAULT_EASE,
      intervalDays: 0,
      lapses: card.lapses ?? 0,
    };
  }

  if (card.state === 'learning') {
    const currentIndex = card.learningStepIndex ?? 0;
    const stepIndexMax = LEARNING_STEPS_MS.length - 1;

    if (rating === 'again') {
      return {
        ...patch,
        state: 'learning',
        learningStepIndex: 0,
        dueAt: now + LEARNING_STEPS_MS[0],
        ease: baseEase,
      };
    }

    if (rating === 'hard') {
      // Design choice: "Hard" repeats the current step (10m or 1d) rather than moving forward.
      const stepMs = LEARNING_STEPS_MS[Math.min(currentIndex, stepIndexMax)];
      return {
        ...patch,
        state: 'learning',
        learningStepIndex: currentIndex,
        dueAt: now + stepMs,
        ease: baseEase,
      };
    }

    if (rating === 'easy') {
      return { ...patch, ...graduateToReview(now, baseEase) };
    }

    // Good
    const nextIndex = currentIndex + 1;
    if (nextIndex > stepIndexMax) {
      return { ...patch, ...graduateToReview(now, baseEase) };
    }
    return {
      ...patch,
      state: 'learning',
      learningStepIndex: nextIndex,
      dueAt: now + LEARNING_STEPS_MS[nextIndex],
      ease: baseEase,
    };
  }

  // Review
  const intervalDays = Math.max(1, card.intervalDays || 1);
  let ease = clamp(baseEase, MIN_EASE, MAX_EASE);
  let nextIntervalDays = intervalDays;

  if (rating === 'again') {
    ease = clamp(ease - 0.2, MIN_EASE, MAX_EASE);
    return {
      ...patch,
      state: 'learning',
      learningStepIndex: 0,
      dueAt: now + LEARNING_STEPS_MS[0],
      lapses: (card.lapses ?? 0) + 1,
      ease,
    };
  }

  if (rating === 'hard') {
    ease = clamp(ease - 0.15, MIN_EASE, MAX_EASE);
    nextIntervalDays = Math.max(1, roundInt(intervalDays * 1.2));
  } else if (rating === 'good') {
    nextIntervalDays = Math.max(1, roundInt(intervalDays * ease));
  } else {
    // easy
    ease = clamp(ease + 0.15, MIN_EASE, MAX_EASE);
    nextIntervalDays = Math.max(1, roundInt(intervalDays * ease * 1.3));
  }

  return {
    ...patch,
    state: 'review',
    intervalDays: nextIntervalDays,
    ease,
    dueAt: now + nextIntervalDays * DAY_MS,
    learningStepIndex: 0,
    lapses: card.lapses ?? 0,
  };
}

