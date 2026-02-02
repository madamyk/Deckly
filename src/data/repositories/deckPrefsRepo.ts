import * as appSettingsRepo from '@/data/repositories/appSettingsRepo';
import type { AiExampleLevel } from '@/domain/prefs';

type DeckPrefs = {
  secondaryLanguage?: string | null;
  exampleLevel?: AiExampleLevel | null;
};

function key(deckId: string): string {
  return `deck.prefs.v1.${deckId}`;
}

function safeParse(json: string): any {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function getDeckPrefs(deckId: string): Promise<DeckPrefs> {
  const raw = await appSettingsRepo.getSetting(key(deckId));
  if (!raw) return {};
  const obj = safeParse(raw);
  if (!obj || typeof obj !== 'object') return {};
  return {
    secondaryLanguage:
      typeof obj.secondaryLanguage === 'string' ? obj.secondaryLanguage.trim() : null,
    exampleLevel:
      obj.exampleLevel === 'easy' ||
      obj.exampleLevel === 'medium' ||
      obj.exampleLevel === 'advanced'
        ? obj.exampleLevel
        : null,
  };
}

export async function getSecondaryLanguage(deckId: string): Promise<string | null> {
  const prefs = await getDeckPrefs(deckId);
  return prefs.secondaryLanguage?.trim() || null;
}

export async function setSecondaryLanguage(deckId: string, value: string | null): Promise<void> {
  const prefs = await getDeckPrefs(deckId);
  const next: DeckPrefs = {
    ...prefs,
    secondaryLanguage: value?.trim() || null,
  };
  await appSettingsRepo.setSetting(key(deckId), JSON.stringify(next));
}

export async function getExampleLevel(deckId: string): Promise<AiExampleLevel | null> {
  const prefs = await getDeckPrefs(deckId);
  return prefs.exampleLevel ?? null;
}

export async function setExampleLevel(deckId: string, value: AiExampleLevel | null): Promise<void> {
  const prefs = await getDeckPrefs(deckId);
  const next: DeckPrefs = {
    ...prefs,
    exampleLevel: value ?? null,
  };
  await appSettingsRepo.setSetting(key(deckId), JSON.stringify(next));
}

export async function deleteDeckPrefs(deckId: string): Promise<void> {
  await appSettingsRepo.deleteSetting(key(deckId));
}
