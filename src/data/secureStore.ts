import * as SecureStore from 'expo-secure-store';

// Stored locally on-device, never logged. Used for optional BYO OpenAI API key.
const KEY_AI_API_KEY = 'deckly.ai.apiKey';

export async function getAiApiKey(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY_AI_API_KEY);
  } catch {
    return null;
  }
}

export async function setAiApiKey(value: string | null): Promise<void> {
  try {
    if (value == null) {
      await SecureStore.deleteItemAsync(KEY_AI_API_KEY);
    } else {
      await SecureStore.setItemAsync(KEY_AI_API_KEY, value);
    }
  } catch {
    // Ignore in MVP; surface errors when feature is enabled.
  }
}
