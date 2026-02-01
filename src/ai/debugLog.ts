import * as appSettingsRepo from '@/data/repositories/appSettingsRepo';
import { makeId } from '@/utils/id';
import { nowMs } from '@/utils/time';

export type AiDebugEntry = {
  id: string;
  at: number; // unix ms
  kind: 'example_pair' | 'language_pair';
  mode: 'single' | 'bulk_missing' | 'bulk_all';
  cardId?: string;
  front?: string;
  back?: string;
  model?: string;
  errorCode?: string;
  errorMessage?: string;
  status?: number;
  prompt?: string;
  responseText?: string;
};

const KEY = 'ai.debug.v1';
const MAX = 50;
const MAX_PROMPT_CHARS = 3000;
const MAX_RESPONSE_CHARS = 3000;

// Serialize writes to avoid lost updates when many failures happen concurrently.
let writeChain: Promise<void> = Promise.resolve();

function safeParse(json: string): any {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function trimTo(s: string | undefined, max: number): string | undefined {
  if (!s) return undefined;
  const t = s.trim();
  if (!t) return undefined;
  return t.length > max ? t.slice(0, max) + '…' : t;
}

export async function listAiDebugEntries(): Promise<AiDebugEntry[]> {
  const raw = await appSettingsRepo.getSetting(KEY);
  const parsed = raw ? safeParse(raw) : null;
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((e) => e && typeof e === 'object')
    .map((e) => ({
      id: String(e.id ?? makeId()),
      at: Number(e.at ?? 0),
      kind: e.kind === 'language_pair' ? ('language_pair' as const) : ('example_pair' as const),
      mode: e.mode === 'single' || e.mode === 'bulk_missing' || e.mode === 'bulk_all' ? e.mode : 'single',
      cardId: typeof e.cardId === 'string' ? e.cardId : undefined,
      front: typeof e.front === 'string' ? e.front : undefined,
      back: typeof e.back === 'string' ? e.back : undefined,
      model: typeof e.model === 'string' ? e.model : undefined,
      errorCode: typeof e.errorCode === 'string' ? e.errorCode : undefined,
      errorMessage: typeof e.errorMessage === 'string' ? e.errorMessage : undefined,
      status: typeof e.status === 'number' ? e.status : undefined,
      prompt: typeof e.prompt === 'string' ? e.prompt : undefined,
      responseText: typeof e.responseText === 'string' ? e.responseText : undefined,
    }))
    .sort((a, b) => b.at - a.at)
    .slice(0, MAX);
}

export async function appendAiDebugEntry(entry: Omit<AiDebugEntry, 'id' | 'at'> & { at?: number }) {
  writeChain = writeChain.then(async () => {
    const existing = await listAiDebugEntries();
    const next: AiDebugEntry = {
      id: makeId(),
      at: entry.at ?? nowMs(),
      kind: entry.kind,
      mode: entry.mode,
      cardId: entry.cardId,
      front: trimTo(entry.front, 200),
      back: trimTo(entry.back, 200),
      model: trimTo(entry.model, 80),
      errorCode: trimTo(entry.errorCode, 80),
      errorMessage: trimTo(entry.errorMessage, 400),
      status: entry.status,
      prompt: trimTo(entry.prompt, MAX_PROMPT_CHARS),
      responseText: trimTo(entry.responseText, MAX_RESPONSE_CHARS),
    };
    const merged = [next, ...existing].slice(0, MAX);
    await appSettingsRepo.setSetting(KEY, JSON.stringify(merged));
  });
  await writeChain;
}

export async function clearAiDebugEntries(): Promise<void> {
  writeChain = writeChain.then(async () => {
    await appSettingsRepo.setSetting(KEY, JSON.stringify([]));
  });
  await writeChain;
}
