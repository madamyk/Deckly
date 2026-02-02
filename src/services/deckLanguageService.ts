import { detectDeckLanguagesWithOpenAi, OpenAiError } from '@/ai/openaiClient';
import { appendAiDebugEntry } from '@/ai/debugLog';
import { isSlowOpenAi } from '@/ai/telemetry';
import type { DeckLanguages } from '@/ai/deckLanguages';
import * as deckAiRepo from '@/data/repositories/deckAiRepo';
import { getAiApiKey } from '@/data/secureStore';
import { usePrefsStore } from '@/stores/prefsStore';

export async function ensureDeckLanguages(params: {
  deckId: string;
  samples: { front: string; back: string; example_front?: string | null; example_back?: string | null }[];
  forceDetect?: boolean;
  signal?: AbortSignal;
}): Promise<{ front_language: string; back_language: string }> {
  const existing = await deckAiRepo.getDeckLanguages(params.deckId);
  if (existing && !params.forceDetect) return existing;

  const prefs = usePrefsStore.getState().prefs.ai;
  if (!prefs.enabled) throw new OpenAiError('disabled', 'AI Assist is turned off. Enable it in Settings.');
  const apiKey = await getAiApiKey();
  if (!apiKey) throw new OpenAiError('missing_key', 'OpenAI API key is missing. Add it in Settings.');

  const cleaned = params.samples
    .map((s) => ({
      front: s.front.trim(),
      back: s.back.trim(),
      example_front: s.example_front ? s.example_front.trim() : '',
      example_back: s.example_back ? s.example_back.trim() : '',
    }))
    .filter((s) => !!s.front && !!s.back)
    .slice(0, 3);
  if (!cleaned.length) {
    // Fallback: treat both as "unknown"; generation may still work, but this is unexpected.
    throw new Error('Not enough sample data to detect deck languages.');
  }

  let langs: DeckLanguages;
  try {
    const result = await detectDeckLanguagesWithOpenAi({
      apiKey,
      prefs,
      samples: cleaned,
      signal: params.signal,
    });
    langs = result.data;
    if (isSlowOpenAi(result.meta)) {
      await appendAiDebugEntry({
        kind: 'language_pair',
        mode: 'single',
        success: true,
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
      kind: 'language_pair',
      mode: 'single',
      model: prefs.model,
      errorCode: oe?.code ?? 'unknown',
      errorMessage: oe?.message ?? String(e?.message ?? e ?? 'Failed'),
      status: oe?.status,
      prompt: oe?.debug?.prompt,
      responseText: oe?.debug?.responseText,
    });
    throw e;
  }

  await deckAiRepo.setDeckLanguages(params.deckId, {
    front_language: langs.front_language,
    back_language: langs.back_language,
  });

  return { front_language: langs.front_language, back_language: langs.back_language };
}
