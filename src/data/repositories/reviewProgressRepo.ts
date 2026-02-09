import * as appSettingsRepo from '@/data/repositories/appSettingsRepo';
import { nowMs } from '@/utils/time';

function dayKey(now = nowMs()): string {
  const d = new Date(now);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function key(deckId: string, day: string): string {
  return `deck.review.progress.v1.${deckId}.${day}`;
}

export async function getDeckReviewedToday(deckId: string, now = nowMs()): Promise<number> {
  const raw = await appSettingsRepo.getSetting(key(deckId, dayKey(now)));
  const n = Number(raw ?? 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

export async function addDeckReviewedToday(deckId: string, delta: number, now = nowMs()): Promise<void> {
  if (!delta) return;
  const current = await getDeckReviewedToday(deckId, now);
  const next = Math.max(0, current + Math.floor(delta));
  await appSettingsRepo.setSetting(key(deckId, dayKey(now)), String(next));
}
