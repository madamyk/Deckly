import {
  buildExampleBatchPrompt,
  buildExamplePrompt,
  parseAndValidateExampleBatchJSON,
  parseAndValidateExampleJSON,
  type ExamplePair,
  type ExamplePairBatchItem,
} from '@/ai/examplePairs';
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
    const response_format = {
      type: 'json_schema',
      json_schema: {
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
    };
    const result = await chatCompletion({
      apiKey: params.apiKey,
      model: params.prefs.model,
      messages,
      response_format,
      reasoningEffort: params.prefs.reasoningEffort,
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

  // First attempt.
  let content = '';
  let meta: OpenAiMeta | null = null;
  try {
    const response_format = {
      type: 'json_schema',
      json_schema: {
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
    };

    const result = await chatCompletion({
      apiKey: params.apiKey,
      model: params.prefs.model,
      messages,
      response_format,
      reasoningEffort: params.prefs.reasoningEffort,
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
    const response_format = {
      type: 'json_schema',
      json_schema: {
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
    };

    const result = await chatCompletion({
      apiKey: params.apiKey,
      model: params.prefs.model,
      messages,
      response_format,
      reasoningEffort: params.prefs.reasoningEffort,
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

export async function chatWithOpenAi(params: {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  reasoningEffort?: AiReasoningEffort;
  signal?: AbortSignal;
}): Promise<{ text: string; meta: OpenAiMeta }> {
  if (!params.apiKey?.trim()) throw new OpenAiError('missing_key', 'OpenAI API key is missing.');
  const result = await chatCompletion({
    apiKey: params.apiKey,
    model: params.model,
    messages: params.messages,
    response_format: undefined,
    reasoningEffort: params.reasoningEffort,
    signal: params.signal,
  });
  return { text: result.content, meta: result.meta };
}

async function chatCompletion(params: {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  response_format?: any;
  reasoningEffort?: AiReasoningEffort;
  signal?: AbortSignal;
}): Promise<{ content: string; meta: OpenAiMeta }> {
  const body: any = {
    model: params.model,
    messages: params.messages,
  };
  if (supportsReasoningEffort(params.model)) {
    body.reasoning_effort = params.reasoningEffort ?? 'low';
  }
  if (params.response_format) {
    body.response_format = params.response_format;
  }

  const start = Date.now();
  const res = await fetchWithRetry(
    'https://api.openai.com/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: params.signal,
    },
    params.signal,
  );
  const durationMs = Date.now() - start;
  const processingMsRaw =
    res.headers.get('openai-processing-ms') ?? res.headers.get('x-openai-processing-ms');
  const parsedProcessingMs = processingMsRaw ? Number(processingMsRaw) : NaN;
  const processingMs = Number.isFinite(parsedProcessingMs) ? parsedProcessingMs : undefined;
  const requestId =
    res.headers.get('x-request-id') ?? res.headers.get('openai-request-id') ?? undefined;
  const meta: OpenAiMeta = { durationMs, processingMs, requestId };

  if (res.status === 401 || res.status === 403) {
    throw new OpenAiError('invalid_key', 'OpenAI API key is invalid.', res.status, {
      model: params.model,
      ...meta,
    });
  }
  if (!res.ok) {
    const text = await safeText(res);
    throw new OpenAiError(
      'bad_response',
      `OpenAI error (${res.status}). ${text}`.trim(),
      res.status,
      {
        model: params.model,
        responseText: text,
        ...meta,
      },
    );
  }

  const data: any = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new OpenAiError('bad_response', 'OpenAI response was empty.', undefined, {
      model: params.model,
      ...meta,
    });
  }
  return { content, meta };
}

function supportsReasoningEffort(model: string): boolean {
  return model.startsWith('gpt-5');
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<Response> {
  const maxAttempts = 3; // 1 + 2 retries
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      const res = await fetch(url, init);
      if (res.status === 429 && attempt < maxAttempts) {
        await sleep(650 * attempt, signal);
        continue;
      }
      return res;
    } catch (e: any) {
      if (signal?.aborted) throw new OpenAiError('cancelled', 'Request cancelled.');
      if (attempt < maxAttempts) {
        await sleep(650 * attempt, signal);
        continue;
      }
      throw new OpenAiError('network', e?.message ?? 'Network error.');
    }
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    const t = await res.text();
    return t.slice(0, 200);
  } catch {
    return '';
  }
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
