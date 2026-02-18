import OpenAI from 'openai';

import {
  buildExampleBatchPrompt,
  buildExamplePrompt,
  parseAndValidateExampleBatchJSON,
  parseAndValidateExampleJSON,
  type ExamplePair,
  type ExamplePairBatchItem,
} from '@/ai/examplePairs';
import { buildTermTranslationPrompt, parseAndValidateTermTranslationJSON } from '@/ai/termTranslation';
import {
  buildDetectDeckLanguagesPrompt,
  parseAndValidateDeckLanguagesJSON,
  type DeckLanguages,
} from '@/ai/deckLanguages';
import type { AiPrefs, AiReasoningEffort } from '@/domain/prefs';

export type OpenAiErrorCode =
  | 'missing_key'
  | 'disabled'
  | 'invalid_key'
  | 'rate_limited'
  | 'network'
  | 'bad_response'
  | 'cancelled'
  | 'invalid_json';

export class OpenAiError extends Error {
  code: OpenAiErrorCode;
  status?: number;
  debug?: {
    model?: string;
    prompt?: string;
    responseText?: string;
    durationMs?: number;
    processingMs?: number;
    requestId?: string;
  };
  constructor(
    code: OpenAiErrorCode,
    message: string,
    status?: number,
    debug?: {
      model?: string;
      prompt?: string;
      responseText?: string;
      durationMs?: number;
      processingMs?: number;
      requestId?: string;
    },
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.debug = debug;
  }
}

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };
export type OpenAiMeta = { durationMs: number; processingMs?: number; requestId?: string };

export async function detectDeckLanguagesWithOpenAi(params: {
  apiKey: string;
  prefs: AiPrefs;
  samples: { front: string; back: string; example_front?: string | null; example_back?: string | null }[];
  signal?: AbortSignal;
}): Promise<{ data: DeckLanguages; meta: OpenAiMeta }> {
  if (!params.apiKey?.trim()) throw new OpenAiError('missing_key', 'OpenAI API key is missing.');

  const prompt = buildDetectDeckLanguagesPrompt({ samples: params.samples });
  const system = [
    `You detect languages for a flashcards deck.`,
    `Return STRICT JSON ONLY (no markdown, no code fences).`,
    `Output keys: front_language, back_language, confidence.`,
  ].join('\n');

  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: prompt },
  ];

  let content = '';
  let meta: OpenAiMeta | null = null;
  try {
    const result = await responsesCompletion({
      apiKey: params.apiKey,
      model: params.prefs.model,
      messages,
      jsonSchema: {
        type: 'json_schema',
        name: 'deck_languages',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['front_language', 'back_language', 'confidence'],
          properties: {
            front_language: { type: 'string' },
            back_language: { type: 'string' },
            confidence: { type: 'number' },
          },
        },
      },
      reasoningEffort: params.prefs.reasoningEffort,
      maxOutputTokens: 400,
      signal: params.signal,
    });
    content = result.content;
    meta = result.meta;
  } catch (e: any) {
    if (e instanceof OpenAiError) {
      throw new OpenAiError(e.code, e.message, e.status, {
        ...(e.debug ?? {}),
        model: params.prefs.model,
        prompt,
      });
    }
    throw e;
  }

  try {
    return { data: parseAndValidateDeckLanguagesJSON(content), meta: meta ?? { durationMs: 0 } };
  } catch (e: any) {
    const msg = typeof e?.message === 'string' ? e.message : 'AI output did not pass validation.';
    throw new OpenAiError('invalid_json', msg, undefined, {
      model: params.prefs.model,
      prompt,
      responseText: content,
      durationMs: meta?.durationMs,
      processingMs: meta?.processingMs,
      requestId: meta?.requestId,
    });
  }
}

export async function generateExamplePairWithOpenAi(params: {
  apiKey: string;
  prefs: AiPrefs;
  frontText: string;
  backText: string;
  front_language: string;
  back_language: string;
  seedExampleFront?: string | null;
  seedExampleBack?: string | null;
  signal?: AbortSignal;
}): Promise<{ pair: ExamplePair; meta: OpenAiMeta }> {
  if (!params.apiKey?.trim()) throw new OpenAiError('missing_key', 'OpenAI API key is missing.');

  const prompt = buildExamplePrompt({
    frontText: params.frontText,
    backText: params.backText,
    front_language: params.front_language,
    back_language: params.back_language,
    level: params.prefs.level,
    seedExampleFront: params.seedExampleFront ?? null,
    seedExampleBack: params.seedExampleBack ?? null,
  });

  const system = [
    `You are a bilingual example generator.`,
    `Return STRICT JSON ONLY (no markdown, no code fences).`,
    `Output keys: example_front, example_back, note.`,
    `Keep example sentences short (~10 words).`,
    `Do not swap or mix languages.`,
  ].join('\n');

  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: prompt },
  ];

  let content = '';
  let meta: OpenAiMeta | null = null;
  try {
    const result = await responsesCompletion({
      apiKey: params.apiKey,
      model: params.prefs.model,
      messages,
      jsonSchema: {
        type: 'json_schema',
        name: 'example_pair',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['example_front', 'example_back', 'note'],
          properties: {
            example_front: { type: 'string' },
            example_back: { type: 'string' },
            note: { type: 'string' },
          },
        },
      },
      reasoningEffort: params.prefs.reasoningEffort,
      maxOutputTokens: 800,
      signal: params.signal,
    });
    content = result.content;
    meta = result.meta;
  } catch (e: any) {
    if (e instanceof OpenAiError) {
      throw new OpenAiError(e.code, e.message, e.status, {
        ...(e.debug ?? {}),
        model: params.prefs.model,
        prompt,
      });
    }
    throw e;
  }

  try {
    return {
      pair: parseAndValidateExampleJSON(content, {
        seedExampleFront: params.seedExampleFront ?? null,
        seedExampleBack: params.seedExampleBack ?? null,
      }),
      meta: meta ?? { durationMs: 0 },
    };
  } catch (e: any) {
    const msg = typeof e?.message === 'string' ? e.message : 'AI output did not pass validation.';
    throw new OpenAiError('invalid_json', msg, undefined, {
      model: params.prefs.model,
      prompt,
      responseText: content,
      durationMs: meta?.durationMs,
      processingMs: meta?.processingMs,
      requestId: meta?.requestId,
    });
  }
}

export async function generateExamplePairsWithOpenAi(params: {
  apiKey: string;
  prefs: AiPrefs;
  items: ExamplePairBatchItem[];
  front_language: string;
  back_language: string;
  signal?: AbortSignal;
}): Promise<{
  pairs: { id: string; pair: ExamplePair }[];
  failures: { id: string; reason: string }[];
  meta: OpenAiMeta;
}> {
  if (!params.apiKey?.trim()) throw new OpenAiError('missing_key', 'OpenAI API key is missing.');

  const prompt = buildExampleBatchPrompt({
    items: params.items,
    front_language: params.front_language,
    back_language: params.back_language,
    level: params.prefs.level,
  });

  const system = [
    `You are a bilingual example generator.`,
    `Return STRICT JSON ONLY (no markdown, no code fences).`,
    `Output keys: items[].id, items[].example_front, items[].example_back, items[].note.`,
    `Keep example sentences short (~10 words).`,
    `Do not swap or mix languages.`,
  ].join('\n');

  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: prompt },
  ];

  let content = '';
  let meta: OpenAiMeta | null = null;
  try {
    const result = await responsesCompletion({
      apiKey: params.apiKey,
      model: params.prefs.model,
      messages,
      jsonSchema: {
        type: 'json_schema',
        name: 'example_pairs',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['items'],
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['id', 'example_front', 'example_back', 'note'],
                properties: {
                  id: { type: 'string' },
                  example_front: { type: 'string' },
                  example_back: { type: 'string' },
                  note: { type: 'string' },
                },
              },
            },
          },
        },
      },
      reasoningEffort: params.prefs.reasoningEffort,
      maxOutputTokens: Math.min(12000, Math.max(2500, params.items.length * 500)),
      signal: params.signal,
    });
    content = result.content;
    meta = result.meta;
  } catch (e: any) {
    if (e instanceof OpenAiError) {
      throw new OpenAiError(e.code, e.message, e.status, {
        ...(e.debug ?? {}),
        model: params.prefs.model,
        prompt,
      });
    }
    throw e;
  }

  try {
    const seedById: Record<string, { seedExampleFront?: string | null; seedExampleBack?: string | null }> = {};
    for (const item of params.items) {
      seedById[item.id] = {
        seedExampleFront: item.seedExampleFront ?? null,
        seedExampleBack: item.seedExampleBack ?? null,
      };
    }
    const parsed = parseAndValidateExampleBatchJSON(content, {
      seedById,
      expectedIds: params.items.map((item) => item.id),
    });
    return {
      pairs: parsed.pairs,
      failures: parsed.failures,
      meta: meta ?? { durationMs: 0 },
    };
  } catch (e: any) {
    const msg = typeof e?.message === 'string' ? e.message : 'AI output did not pass validation.';
    throw new OpenAiError('invalid_json', msg, undefined, {
      model: params.prefs.model,
      prompt,
      responseText: content,
      durationMs: meta?.durationMs,
      processingMs: meta?.processingMs,
      requestId: meta?.requestId,
    });
  }
}

export async function translateTermWithOpenAi(params: {
  apiKey: string;
  prefs: AiPrefs;
  sourceText: string;
  targetLanguage: string;
  sourceLanguage?: string | null;
  signal?: AbortSignal;
}): Promise<{ translation: string; meta: OpenAiMeta }> {
  if (!params.apiKey?.trim()) throw new OpenAiError('missing_key', 'OpenAI API key is missing.');

  const prompt = buildTermTranslationPrompt({
    sourceText: params.sourceText,
    targetLanguage: params.targetLanguage,
    sourceLanguage: params.sourceLanguage ?? null,
  });

  const system = [
    `You are a bilingual dictionary assistant.`,
    `Return STRICT JSON ONLY (no markdown, no code fences).`,
    `Output keys: translation.`,
  ].join('\n');

  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: prompt },
  ];

  let content = '';
  let meta: OpenAiMeta | null = null;
  try {
    const result = await responsesCompletion({
      apiKey: params.apiKey,
      model: params.prefs.model,
      messages,
      jsonSchema: {
        type: 'json_schema',
        name: 'term_translation',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['translation'],
          properties: {
            translation: { type: 'string' },
          },
        },
      },
      reasoningEffort: params.prefs.reasoningEffort,
      maxOutputTokens: 220,
      signal: params.signal,
    });
    content = result.content;
    meta = result.meta;
  } catch (e: any) {
    if (e instanceof OpenAiError) {
      throw new OpenAiError(e.code, e.message, e.status, {
        ...(e.debug ?? {}),
        model: params.prefs.model,
        prompt,
      });
    }
    throw e;
  }

  try {
    return {
      translation: parseAndValidateTermTranslationJSON(content),
      meta: meta ?? { durationMs: 0 },
    };
  } catch (e: any) {
    const msg = typeof e?.message === 'string' ? e.message : 'AI output did not pass validation.';
    throw new OpenAiError('invalid_json', msg, undefined, {
      model: params.prefs.model,
      prompt,
      responseText: content,
      durationMs: meta?.durationMs,
      processingMs: meta?.processingMs,
      requestId: meta?.requestId,
    });
  }
}

export async function chatWithOpenAi(params: {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  reasoningEffort?: AiReasoningEffort;
  signal?: AbortSignal;
}): Promise<{ text: string; meta: OpenAiMeta }> {
  if (!params.apiKey?.trim()) throw new OpenAiError('missing_key', 'OpenAI API key is missing.');
  const result = await responsesCompletion({
    apiKey: params.apiKey,
    model: params.model,
    messages: params.messages,
    reasoningEffort: params.reasoningEffort,
    signal: params.signal,
  });
  return { text: result.content, meta: result.meta };
}

function createClient(apiKey: string): OpenAI {
  return new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true,
    maxRetries: 0,
  });
}

async function responsesCompletion(params: {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  reasoningEffort?: AiReasoningEffort;
  jsonSchema?: {
    type: 'json_schema';
    name: string;
    strict: boolean;
    schema: Record<string, unknown>;
  };
  maxOutputTokens?: number;
  signal?: AbortSignal;
}): Promise<{ content: string; meta: OpenAiMeta }> {
  const client = createClient(params.apiKey);

  const systemInstruction = params.messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content.trim())
    .filter(Boolean)
    .join('\n\n');
  const inputMessages = params.messages.filter((m) => m.role !== 'system');
  if (!inputMessages.length) {
    throw new OpenAiError('bad_response', 'At least one non-system message is required.');
  }

  const request: any = {
    model: params.model,
    input: inputMessages.map((message) => ({
      role: message.role,
      content: [{ type: 'input_text', text: message.content }],
    })),
  };

  if (systemInstruction) request.instructions = systemInstruction;
  if (supportsReasoningEffort(params.model)) {
    request.reasoning = { effort: params.reasoningEffort ?? 'low' };
  }
  if (params.jsonSchema) {
    request.text = { format: params.jsonSchema };
  }
  if (typeof params.maxOutputTokens === 'number') {
    request.max_output_tokens = params.maxOutputTokens;
  }

  const start = Date.now();
  const runResponse = () => client.responses.create(request, { signal: params.signal });
  let response = await runResponsesWithRetry(runResponse, params.signal);
  const initialIncompleteReason = getIncompleteReason(response);
  if (initialIncompleteReason === 'max_output_tokens' && typeof request.max_output_tokens === 'number') {
    // One automatic retry with a larger output budget prevents common JSON truncation failures.
    request.max_output_tokens = Math.min(20000, Math.max(request.max_output_tokens * 2, 1200));
    response = await runResponsesWithRetry(runResponse, params.signal);
  }
  const durationMs = Date.now() - start;
  const requestId =
    (response as any)?._request_id ??
    (response as any)?.request_id ??
    undefined;
  const meta: OpenAiMeta = { durationMs, requestId };

  const incompleteReason = getIncompleteReason(response);
  if (incompleteReason) {
    throw new OpenAiError(
      'bad_response',
      `OpenAI response was incomplete (${incompleteReason}).`,
      undefined,
      {
        model: params.model,
        responseText: extractOutputText(response),
        ...meta,
      },
    );
  }

  const content = extractOutputText(response);
  if (!content.trim()) {
    throw new OpenAiError('bad_response', 'OpenAI response was empty.', undefined, {
      model: params.model,
      ...meta,
    });
  }
  return { content, meta };
}

function extractOutputText(response: any): string {
  if (typeof response?.output_text === 'string' && response.output_text.trim()) {
    return response.output_text;
  }

  const chunks: string[] = [];
  const outputItems = Array.isArray(response?.output) ? response.output : [];
  for (const item of outputItems) {
    if (item?.type !== 'message') continue;
    const contentItems = Array.isArray(item?.content) ? item.content : [];
    for (const contentItem of contentItems) {
      if (contentItem?.type !== 'output_text') continue;
      if (typeof contentItem?.text !== 'string' || !contentItem.text) continue;
      chunks.push(contentItem.text);
    }
  }
  return chunks.join('\n');
}

function getIncompleteReason(response: any): string | null {
  const status = typeof response?.status === 'string' ? response.status : '';
  if (status !== 'incomplete') return null;
  const reason = response?.incomplete_details?.reason;
  return typeof reason === 'string' && reason ? reason : 'unknown_reason';
}

async function runResponsesWithRetry<T>(
  fn: () => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  const maxAttempts = 3; // 1 + 2 retries
  let attempt = 0;

  while (true) {
    attempt++;
    try {
      return await fn();
    } catch (error: any) {
      if (isAborted(error, signal)) {
        throw new OpenAiError('cancelled', 'Request cancelled.');
      }

      const status = getStatus(error);
      if ((status === 429 || (typeof status === 'number' && status >= 500)) && attempt < maxAttempts) {
        await sleep(650 * attempt, signal);
        continue;
      }
      if (status === 401 || status === 403) {
        throw new OpenAiError('invalid_key', 'OpenAI API key is invalid.', status);
      }
      if (status === 429) {
        throw new OpenAiError('rate_limited', 'OpenAI rate limit exceeded. Please retry shortly.', status);
      }
      if (typeof status === 'number') {
        throw new OpenAiError(
          'bad_response',
          `OpenAI error (${status}). ${errorSnippet(error)}`.trim(),
          status,
        );
      }

      if (attempt < maxAttempts) {
        await sleep(650 * attempt, signal);
        continue;
      }

      throw new OpenAiError('network', error?.message ?? 'Network error.');
    }
  }
}

function supportsReasoningEffort(model: string): boolean {
  return model.startsWith('gpt-5');
}

function getStatus(error: any): number | undefined {
  const candidates = [error?.status, error?.statusCode, error?.response?.status];
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate;
  }
  return undefined;
}

function isAborted(error: any, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  if (error?.name === 'AbortError') return true;
  if (error?.code === 'ABORT_ERR') return true;
  return false;
}

function errorSnippet(error: any): string {
  const message = typeof error?.message === 'string' ? error.message : '';
  return message.slice(0, 200);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(id);
        reject(new OpenAiError('cancelled', 'Request cancelled.'));
      },
      { once: true },
    );
  });
}
