import Constants from 'expo-constants';

import { getAiApiKey, setAiApiKey } from '@/data/secureStore';

type Extra = {
  devOpenAiApiKey?: string | null;
};

/**
 * Dev helper: optionally seed SecureStore with an API key from an env var.
 *
 * IMPORTANT:
 * - This is guarded by `__DEV__`.
 * - The env-provided key can still end up in the JS bundle via Expo config `extra`.
 * - Use for local dev only; never ship with this set.
 */
export async function bootstrapDevOpenAiKey(): Promise<void> {
  if (!__DEV__) return;

  try {
    const extra = (Constants.expoConfig?.extra ?? {}) as Extra;
    const raw = (extra as any)?.devOpenAiApiKey;
    const fromEnv = typeof raw === 'string' ? raw.trim() : '';
    if (!fromEnv) return;

    const existing = await getAiApiKey();
    if (existing) return; // don't overwrite a saved key

    await setAiApiKey(fromEnv);
  } catch {
    // Optional dev helper: never crash the app if Expo config extras are missing/malformed.
  }
}
