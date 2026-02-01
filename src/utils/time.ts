import { differenceInCalendarDays } from 'date-fns';

export const MINUTE_MS = 60_000;
export const DAY_MS = 24 * 60 * 60_000;

export function nowMs(): number {
  return Date.now();
}

export function formatShortDateTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Human-readable "due" formatting for lists.
 * Examples: "Due today", "Due in 7 days", "Due 1 month ago".
 * (No specific time-of-day.)
 */
export function formatDueRelative(dueAtMs: number, nowMsValue: number = Date.now()): string {
  const now = new Date(nowMsValue);
  const due = new Date(dueAtMs);

  const dayDiff = differenceInCalendarDays(due, now);
  if (!Number.isFinite(dayDiff)) return 'Due today';
  // If it's due in the past (yesterday or older), we still show "Due today" to avoid "past due" labels.
  if (dayDiff <= 0) return 'Due today';
  if (dayDiff === 1) return 'Due tomorrow';

  const absDays = Math.abs(dayDiff);

  // We intentionally base relative formatting on calendar days to avoid cases like "in 0 days".
  const unit = absDays >= 365 ? 'year' : absDays >= 30 ? 'month' : 'day';
  const n =
    unit === 'year'
      ? Math.round(absDays / 365)
      : unit === 'month'
        ? Math.round(absDays / 30)
        : absDays;

  // Safety: avoid "0 days/months/years" due to rounding.
  const safeN = Math.max(1, n);
  const plural = safeN === 1 ? unit : `${unit}s`;

  return `Due in ${safeN} ${plural}`;
}
