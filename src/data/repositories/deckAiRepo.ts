import * as appSettingsRepo from '@/data/repositories/appSettingsRepo';

type StoredDeckAi = {
  front_language: string;
  back_language: string;
  detectedAt: number;
};

function key(deckId: string): string {
  return `deck.ai.v1.${deckId}`;
}

function safeParse(json: string): any {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function getDeckLanguages(deckId: string): Promise<{ front_language: string; back_language: string } | null> {
  const raw = await appSettingsRepo.getSetting(key(deckId));
  if (!raw) return null;
  const obj = safeParse(raw);
  if (!obj || typeof obj !== 'object') return null;
  const front_language = typeof obj.front_language === 'string' ? obj.front_language.trim() : '';
  const back_language = typeof obj.back_language === 'string' ? obj.back_language.trim() : '';
  if (!front_language || !back_language) return null;
  return { front_language, back_language };
}

export async function setDeckLanguages(deckId: string, langs: { front_language: string; back_language: string }): Promise<void> {
  const front_language = langs.front_language.trim();
  const back_language = langs.back_language.trim();
  if (!front_language || !back_language) return;

  const payload: StoredDeckAi = {
    front_language,
    back_language,
    detectedAt: Date.now(),
  };
  await appSettingsRepo.setSetting(key(deckId), JSON.stringify(payload));
}

export async function deleteDeckLanguages(deckId: string): Promise<void> {
  await appSettingsRepo.deleteSetting(key(deckId));
}
