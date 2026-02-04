import { generateExamplePairWithOpenAi, generateExamplePairsWithOpenAi, OpenAiError } from '@/ai/openaiClient';
import { applyExampleToCardPatch, type ExamplePair } from '@/ai/examplePairs';
import { appendAiDebugEntry } from '@/ai/debugLog';
import { isSlowOpenAi } from '@/ai/telemetry';
import { getAiApiKey } from '@/data/secureStore';
import * as cardsRepo from '@/data/repositories/cardsRepo';
import * as deckAiRepo from '@/data/repositories/deckAiRepo';
import type { AiExampleLevel } from '@/domain/prefs';
import { usePrefsStore } from '@/stores/prefsStore';
import { ensureDeckLanguages } from '@/services/deckLanguageService';
import { nowMs } from '@/utils/time';
import { pLimit } from '@/utils/pLimit';

export async function generateExamplePair(params: {
  deckId: string;
  frontText: string;
  backText: string;
  levelOverride?: AiExampleLevel;
  signal?: AbortSignal;
}): Promise<{ pair: ExamplePair; patch: ReturnType<typeof applyExampleToCardPatch> }> {
  const prefs = usePrefsStore.getState().prefs.ai;
  const prefsForGen = {
    ...prefs,
    level: params.levelOverride ?? prefs.level,
  };
  if (!prefs.enabled) throw new OpenAiError('disabled', 'AI Assist is turned off. Enable it in Settings.');
  const apiKey = await getAiApiKey();
  if (!apiKey) throw new OpenAiError('missing_key', 'OpenAI API key is missing. Add it in Settings.');

  const langs =
    (await deckAiRepo.getDeckLanguages(params.deckId)) ??
    (await ensureDeckLanguages({
      deckId: params.deckId,
      samples: [{ front: params.frontText, back: params.backText }],
      signal: params.signal,
    }));

  let pair: ExamplePair;
  try {
    const result = await generateExamplePairWithOpenAi({
      apiKey,
      prefs: prefsForGen,
      frontText: params.frontText,
      backText: params.backText,
      front_language: langs.front_language,
      back_language: langs.back_language,
      seedExampleFront: null,
      seedExampleBack: null,
      signal: params.signal,
    });
    pair = result.pair;
    if (isSlowOpenAi(result.meta)) {
      await appendAiDebugEntry({
        kind: 'example_pair',
        mode: 'single',
        success: true,
        front: params.frontText,
        back: params.backText,
        model: prefs.model,
        durationMs: result.meta.durationMs,
        processingMs: result.meta.processingMs,
        requestId: result.meta.requestId,
      });
    }
  } catch (e: any) {
    if (params.signal?.aborted || e?.code === 'cancelled') throw e;
    const oe: OpenAiError | null = e instanceof OpenAiError ? e : null;
    await appendAiDebugEntry({
      kind: 'example_pair',
      mode: 'single',
      front: params.frontText,
      back: params.backText,
      model: prefs.model,
      errorCode: oe?.code ?? 'unknown',
      errorMessage: oe?.message ?? String(e?.message ?? e ?? 'Failed'),
      status: oe?.status,
      prompt: oe?.debug?.prompt,
      responseText: oe?.debug?.responseText,
    });
    throw e;
  }

  const patch = applyExampleToCardPatch(pair, { source: 'ai', now: nowMs() });
  return { pair, patch };
}

export async function generateAndPersistExamplePairs(params: {
  deckId: string;
  cards: { id: string; front: string; back: string; exampleL1: string | null; exampleL2: string | null }[];
  mode: 'missing' | 'all';
  levelOverride?: AiExampleLevel;
  concurrency?: number;
  batchSize?: number;
  signal?: AbortSignal;
  onFirstBatchResponse?: () => void;
  onProgress?: (p: { done: number; total: number; failed: number }) => void;
}): Promise<{ done: number; total: number; failed: { cardId: string; reason: string }[] }> {
  const prefs = usePrefsStore.getState().prefs.ai;
  const prefsForGen = {
    ...prefs,
    level: params.levelOverride ?? prefs.level,
  };
  if (!prefs.enabled) throw new OpenAiError('disabled', 'AI Assist is turned off. Enable it in Settings.');
  const apiKey = await getAiApiKey();
  if (!apiKey) throw new OpenAiError('missing_key', 'OpenAI API key is missing. Add it in Settings.');

  const toGenerate =
    params.mode === 'all'
      ? params.cards
      : params.cards.filter((c) => !c.exampleL1?.trim() || !c.exampleL2?.trim());

  const total = toGenerate.length;
  const failed: { cardId: string; reason: string }[] = [];
  let done = 0;
  let firstBatchResponseSent = false;

  const markFirstBatchResponse = () => {
    if (firstBatchResponseSent) return;
    firstBatchResponseSent = true;
    params.onFirstBatchResponse?.();
  };

  const langs =
    (await deckAiRepo.getDeckLanguages(params.deckId)) ??
    (await ensureDeckLanguages({
      deckId: params.deckId,
      samples: toGenerate.slice(0, 3).map((c) => ({ front: c.front, back: c.back })),
      signal: params.signal,
    }));

  const candidates: (typeof toGenerate[number] & { frontText: string; backText: string })[] = [];
  for (const c of toGenerate) {
    const frontText = c.front.trim();
    const backText = c.back.trim();
    if (!frontText || !backText) {
      failed.push({ cardId: c.id, reason: 'Front/back is empty.' });
      done++;
      params.onProgress?.({ done, total, failed: failed.length });
      continue;
    }
    candidates.push({ ...c, frontText, backText });
  }

  const batchSize = Math.max(1, params.batchSize ?? 1);
  const batches: typeof candidates[] = [];
  for (let i = 0; i < candidates.length; i += batchSize) {
    batches.push(candidates.slice(i, i + batchSize));
  }

  const limit = pLimit(params.concurrency ?? 2);
  await Promise.all(
    batches.map((batch) =>
      limit(async () => {
        if (params.signal?.aborted) return;
        const items = batch.map((c) => ({
          id: c.id,
          frontText: c.frontText,
          backText: c.backText,
          seedExampleFront:
            params.mode === 'missing' ? (c.exampleL1?.trim() ? c.exampleL1.trim() : null) : null,
          seedExampleBack:
            params.mode === 'missing' ? (c.exampleL2?.trim() ? c.exampleL2.trim() : null) : null,
        }));

        try {
          const result = await generateExamplePairsWithOpenAi({
            apiKey,
            prefs: prefsForGen,
            front_language: langs.front_language,
            back_language: langs.back_language,
            items,
            signal: params.signal,
          });
          markFirstBatchResponse();
          const pairsById = new Map(result.pairs.map((p) => [p.id, p.pair]));
          const failuresById = new Map(result.failures.map((f) => [f.id, f.reason]));

          for (const c of batch) {
            if (params.signal?.aborted) return;
            const failureReason = failuresById.get(c.id);
            const pair = pairsById.get(c.id);
            if (!pair || failureReason) {
              failed.push({ cardId: c.id, reason: failureReason ?? 'AI returned invalid example(s).' });
              done++;
              params.onProgress?.({ done, total, failed: failed.length });
              continue;
            }
            try {
              const patch = applyExampleToCardPatch(pair, { source: 'ai', now: nowMs() });
              // "Missing" mode should not overwrite CSV-provided examples.
              if (params.mode === 'missing') {
                if (c.exampleL1?.trim()) patch.exampleL1 = c.exampleL1.trim();
                if (c.exampleL2?.trim()) patch.exampleL2 = c.exampleL2.trim();
              }
              await cardsRepo.updateCard(c.id, patch);
              if (isSlowOpenAi(result.meta)) {
                await appendAiDebugEntry({
                  kind: 'example_pair',
                  mode: params.mode === 'all' ? 'bulk_all' : 'bulk_missing',
                  success: true,
                  cardId: c.id,
                  front: c.front,
                  back: c.back,
                  model: prefs.model,
                  durationMs: result.meta.durationMs,
                  processingMs: result.meta.processingMs,
                  requestId: result.meta.requestId,
                });
              }
            } catch (e: any) {
              failed.push({ cardId: c.id, reason: e?.message ?? 'Failed.' });
            } finally {
              done++;
              params.onProgress?.({ done, total, failed: failed.length });
            }
          }
        } catch (e: any) {
          if (params.signal?.aborted || e?.code === 'cancelled') {
            // User cancelled: stop treating as a failure.
            return;
          }
          markFirstBatchResponse();
          const oe: OpenAiError | null = e instanceof OpenAiError ? e : null;
          for (const c of batch) {
            await appendAiDebugEntry({
              kind: 'example_pair',
              mode: params.mode === 'all' ? 'bulk_all' : 'bulk_missing',
              cardId: c.id,
              front: c.front,
              back: c.back,
              model: prefs.model,
              errorCode: oe?.code ?? 'unknown',
              errorMessage: oe?.message ?? String(e?.message ?? e ?? 'Failed'),
              status: oe?.status,
              prompt: oe?.debug?.prompt,
              responseText: oe?.debug?.responseText,
            });
            failed.push({ cardId: c.id, reason: e?.message ?? 'Failed.' });
            done++;
            params.onProgress?.({ done, total, failed: failed.length });
          }
        }
      }),
    ),
  );

  return { done, total, failed };
}

export async function generateExamplePairsInMemory(params: {
  deckId: string;
  cards: { id: string; front: string; back: string; exampleL1: string | null; exampleL2: string | null }[];
  mode: 'missing' | 'all';
  levelOverride?: AiExampleLevel;
  concurrency?: number;
  batchSize?: number;
  signal?: AbortSignal;
  onFirstBatchResponse?: () => void;
  onProgress?: (p: { done: number; total: number; failed: number }) => void;
}): Promise<{
  done: number;
  total: number;
  failed: { cardId: string; reason: string }[];
  patches: Record<string, ReturnType<typeof applyExampleToCardPatch>>;
}> {
  const prefs = usePrefsStore.getState().prefs.ai;
  const prefsForGen = {
    ...prefs,
    level: params.levelOverride ?? prefs.level,
  };
  if (!prefs.enabled) throw new OpenAiError('disabled', 'AI Assist is turned off. Enable it in Settings.');
  const apiKey = await getAiApiKey();
  if (!apiKey) throw new OpenAiError('missing_key', 'OpenAI API key is missing. Add it in Settings.');

  const toGenerate =
    params.mode === 'all'
      ? params.cards
      : params.cards.filter((c) => !c.exampleL1?.trim() || !c.exampleL2?.trim());

  const total = toGenerate.length;
  const failed: { cardId: string; reason: string }[] = [];
  const patches: Record<string, ReturnType<typeof applyExampleToCardPatch>> = {};
  let done = 0;
  let firstBatchResponseSent = false;

  const markFirstBatchResponse = () => {
    if (firstBatchResponseSent) return;
    firstBatchResponseSent = true;
    params.onFirstBatchResponse?.();
  };

  const langs =
    (await deckAiRepo.getDeckLanguages(params.deckId)) ??
    (await ensureDeckLanguages({
      deckId: params.deckId,
      samples: toGenerate.slice(0, 3).map((c) => ({ front: c.front, back: c.back })),
      signal: params.signal,
    }));

  const candidates: (typeof toGenerate[number] & { frontText: string; backText: string })[] = [];
  for (const c of toGenerate) {
    const frontText = c.front.trim();
    const backText = c.back.trim();
    if (!frontText || !backText) {
      failed.push({ cardId: c.id, reason: 'Front/back is empty.' });
      done++;
      params.onProgress?.({ done, total, failed: failed.length });
      continue;
    }
    candidates.push({ ...c, frontText, backText });
  }

  const batchSize = Math.max(1, params.batchSize ?? 1);
  const batches: typeof candidates[] = [];
  for (let i = 0; i < candidates.length; i += batchSize) {
    batches.push(candidates.slice(i, i + batchSize));
  }

  const limit = pLimit(params.concurrency ?? 2);
  await Promise.all(
    batches.map((batch) =>
      limit(async () => {
        if (params.signal?.aborted) return;
        const items = batch.map((c) => ({
          id: c.id,
          frontText: c.frontText,
          backText: c.backText,
          seedExampleFront:
            params.mode === 'missing' ? (c.exampleL1?.trim() ? c.exampleL1.trim() : null) : null,
          seedExampleBack:
            params.mode === 'missing' ? (c.exampleL2?.trim() ? c.exampleL2.trim() : null) : null,
        }));

        try {
          const result = await generateExamplePairsWithOpenAi({
            apiKey,
            prefs: prefsForGen,
            front_language: langs.front_language,
            back_language: langs.back_language,
            items,
            signal: params.signal,
          });
          markFirstBatchResponse();
          const pairsById = new Map(result.pairs.map((p) => [p.id, p.pair]));
          const failuresById = new Map(result.failures.map((f) => [f.id, f.reason]));

          for (const c of batch) {
            if (params.signal?.aborted) return;
            const failureReason = failuresById.get(c.id);
            const pair = pairsById.get(c.id);
            if (!pair || failureReason) {
              failed.push({ cardId: c.id, reason: failureReason ?? 'AI returned invalid example(s).' });
              done++;
              params.onProgress?.({ done, total, failed: failed.length });
              continue;
            }
            const patch = applyExampleToCardPatch(pair, { source: 'ai', now: nowMs() });
            if (params.mode === 'missing') {
              if (c.exampleL1?.trim()) patch.exampleL1 = c.exampleL1.trim();
              if (c.exampleL2?.trim()) patch.exampleL2 = c.exampleL2.trim();
            }
            patches[c.id] = patch;
            if (isSlowOpenAi(result.meta)) {
              await appendAiDebugEntry({
                kind: 'example_pair',
                mode: params.mode === 'all' ? 'bulk_all' : 'bulk_missing',
                success: true,
                cardId: c.id,
                front: c.front,
                back: c.back,
                model: prefs.model,
                durationMs: result.meta.durationMs,
                processingMs: result.meta.processingMs,
                requestId: result.meta.requestId,
              });
            }
            done++;
            params.onProgress?.({ done, total, failed: failed.length });
          }
        } catch (e: any) {
          if (params.signal?.aborted || e?.code === 'cancelled') {
            return;
          }
          markFirstBatchResponse();
          const oe: OpenAiError | null = e instanceof OpenAiError ? e : null;
          for (const c of batch) {
            await appendAiDebugEntry({
              kind: 'example_pair',
              mode: params.mode === 'all' ? 'bulk_all' : 'bulk_missing',
              cardId: c.id,
              front: c.front,
              back: c.back,
              model: prefs.model,
              errorCode: oe?.code ?? 'unknown',
              errorMessage: oe?.message ?? String(e?.message ?? e ?? 'Failed'),
              status: oe?.status,
              prompt: oe?.debug?.prompt,
              responseText: oe?.debug?.responseText,
            });
            failed.push({ cardId: c.id, reason: e?.message ?? 'Failed.' });
            done++;
            params.onProgress?.({ done, total, failed: failed.length });
          }
        }
      }),
    ),
  );

  return { done, total, failed, patches };
}
