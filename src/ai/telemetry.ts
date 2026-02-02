import type { OpenAiMeta } from '@/ai/openaiClient';

export const SLOW_OPENAI_MS = 10000;

export function isSlowOpenAi(meta?: OpenAiMeta | null): meta is OpenAiMeta {
  return !!meta && meta.durationMs >= SLOW_OPENAI_MS;
}
