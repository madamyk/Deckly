import { OpenAiError, translateTermWithOpenAi } from '@/ai/openaiClient';
import { getAiApiKey } from '@/data/secureStore';
import { usePrefsStore } from '@/stores/prefsStore';

export async function generateTermTranslation(params: {
  sourceText: string;
  targetLanguage: string;
  sourceLanguage?: string | null;
  signal?: AbortSignal;
}): Promise<{ translation: string }> {
  const prefs = usePrefsStore.getState().prefs.ai;
  if (!prefs.enabled) throw new OpenAiError('disabled', 'AI Assist is turned off. Enable it in Settings.');
  const apiKey = await getAiApiKey();
  if (!apiKey) throw new OpenAiError('missing_key', 'OpenAI API key is missing. Add it in Settings.');

  const result = await translateTermWithOpenAi({
    apiKey,
    prefs,
    sourceText: params.sourceText,
    targetLanguage: params.targetLanguage,
    sourceLanguage: params.sourceLanguage ?? null,
    signal: params.signal,
  });
  return { translation: result.translation };
}
