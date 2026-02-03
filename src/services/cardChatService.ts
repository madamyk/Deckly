import { buildTeacherSystemPrompt } from '@/ai/teacherChat';
import { chatWithOpenAi, OpenAiError, type ChatMessage } from '@/ai/openaiClient';
import { appendAiDebugEntry } from '@/ai/debugLog';
import { isSlowOpenAi } from '@/ai/telemetry';
import type { Card } from '@/domain/models';
import type { AiReasoningEffort } from '@/domain/prefs';
import { getAiApiKey } from '@/data/secureStore';
import { usePrefsStore } from '@/stores/prefsStore';
import { ensureDeckLanguages } from '@/services/deckLanguageService';

export type ChatHistoryItem = { role: 'user' | 'assistant'; text: string };

export async function sendCardChatMessage(params: {
  deckId: string;
  card: Card;
  question: string;
  history?: ChatHistoryItem[];
  extraSystemInstruction?: string | null;
  modelOverride?: string;
  reasoningEffortOverride?: AiReasoningEffort;
  signal?: AbortSignal;
}): Promise<string> {
  const prefs = usePrefsStore.getState().prefs.ai;
  const model = params.modelOverride ?? prefs.model;
  const reasoningEffort = params.reasoningEffortOverride ?? prefs.reasoningEffort;
  if (!prefs.enabled) throw new OpenAiError('disabled', 'AI Assist is turned off. Enable it in Settings.');
  const apiKey = await getAiApiKey();
  if (!apiKey) throw new OpenAiError('missing_key', 'OpenAI API key is missing. Add it in Settings.');

  const langs = await ensureDeckLanguages({
    deckId: params.deckId,
    samples: [
      {
        front: params.card.front,
        back: params.card.back,
        example_front: params.card.exampleL1,
        example_back: params.card.exampleL2,
      },
    ],
    signal: params.signal,
  });

  const system = buildTeacherSystemPrompt({
    frontText: params.card.front,
    backText: params.card.back,
    note: params.card.exampleNote,
    front_language: langs.front_language,
    back_language: langs.back_language,
    extraInstruction: params.extraSystemInstruction,
  });

  const historyMessages: ChatMessage[] = (params.history ?? []).map((m) => ({
    role: m.role,
    content: m.text,
  }));

  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    ...historyMessages,
    { role: 'user', content: params.question },
  ];

  try {
    const reply = await chatWithOpenAi({
      apiKey,
      model,
      messages,
      reasoningEffort,
      signal: params.signal,
    });
    if (isSlowOpenAi(reply.meta)) {
      await appendAiDebugEntry({
        kind: 'chat',
        mode: 'single',
        success: true,
        cardId: params.card.id,
        front: params.card.front,
        back: params.card.back,
        model,
        durationMs: reply.meta.durationMs,
        processingMs: reply.meta.processingMs,
        requestId: reply.meta.requestId,
      });
    }
    return reply.text.trim();
  } catch (e: any) {
    if (params.signal?.aborted || e?.code === 'cancelled') throw e;
    const oe: OpenAiError | null = e instanceof OpenAiError ? e : null;
    await appendAiDebugEntry({
      kind: 'chat',
      mode: 'single',
      cardId: params.card.id,
      front: params.card.front,
      back: params.card.back,
      model,
      errorCode: oe?.code ?? 'unknown',
      errorMessage: oe?.message ?? String(e?.message ?? e ?? 'Failed'),
      status: oe?.status,
      prompt: system,
      responseText: oe?.debug?.responseText,
    });
    throw e;
  }
}
