import { buildExamplePrompt, parseAndValidateExampleJSON, type ExamplePair } from '@/ai/examplePairs';
import {
  buildDetectDeckLanguagesPrompt,
  parseAndValidateDeckLanguagesJSON,
  type DeckLanguages,
} from '@/ai/deckLanguages';
import type { AiPrefs } from '@/domain/prefs';

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
  debug?: { model?: string; prompt?: string; responseText?: string };
  constructor(
    code: OpenAiErrorCode,
    message: string,
    status?: number,
    debug?: { model?: string; prompt?: string; responseText?: string },
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.debug = debug;
  }
}

type ChatMessage = { role: 'system' | 'user'; content: string };

export async function detectDeckLanguagesWithOpenAi(params: {
  apiKey: string;
  prefs: AiPrefs;
  samples: { front: string; back: string; example_front?: string | null; example_back?: string | null }[];
  signal?: AbortSignal;
}): Promise<DeckLanguages> {
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
    content = await chatCompletion({
      apiKey: params.apiKey,
      model: params.prefs.model,
      messages,
      response_format,
      signal: params.signal,
    });
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
    return parseAndValidateDeckLanguagesJSON(content);
  } catch (e: any) {
    const msg = typeof e?.message === 'string' ? e.message : 'AI output did not pass validation.';
    throw new OpenAiError('invalid_json', msg, undefined, {
      model: params.prefs.model,
      prompt,
      responseText: content,
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
}): Promise<ExamplePair> {
  if (!params.apiKey?.trim()) throw new OpenAiError('missing_key', 'OpenAI API key is missing.');

  const prompt = buildExamplePrompt({
    frontText: params.frontText,
    backText: params.backText,
    front_language: params.front_language,
    back_language: params.back_language,
    level: params.prefs.level,
    domain: params.prefs.domain,
    seedExampleFront: params.seedExampleFront ?? null,
    seedExampleBack: params.seedExampleBack ?? null,
  });

  const system = [
    `You are a bilingual example generator.`,
    `Return STRICT JSON ONLY (no markdown, no code fences).`,
    `Output keys: example_front, example_back, note.`,
    `Do not swap or mix languages.`,
  ].join('\n');

  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: prompt },
  ];

  // First attempt.
  let content = '';
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

    content = await chatCompletion({
      apiKey: params.apiKey,
      model: params.prefs.model,
      messages,
      response_format,
      signal: params.signal,
    });
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
    return parseAndValidateExampleJSON(content, {
      seedExampleFront: params.seedExampleFront ?? null,
      seedExampleBack: params.seedExampleBack ?? null,
    });
  } catch (e: any) {
    const msg = typeof e?.message === 'string' ? e.message : 'AI output did not pass validation.';
    throw new OpenAiError('invalid_json', msg, undefined, {
      model: params.prefs.model,
      prompt,
      responseText: content,
    });
  }
}

async function chatCompletion(params: {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  response_format: any;
  signal?: AbortSignal;
}): Promise<string> {
  const body: any = {
    model: params.model,
    messages: params.messages,
  };
  body.response_format = params.response_format;

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

  if (res.status === 401 || res.status === 403) {
    throw new OpenAiError('invalid_key', 'OpenAI API key is invalid.', res.status);
  }
  if (!res.ok) {
    const text = await safeText(res);
    throw new OpenAiError('bad_response', `OpenAI error (${res.status}). ${text}`.trim(), res.status, {
      model: params.model,
      responseText: text,
    });
  }

  const data: any = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new OpenAiError('bad_response', 'OpenAI response was empty.');
  }
  return content;
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
