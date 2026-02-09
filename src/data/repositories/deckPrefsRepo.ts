import * as appSettingsRepo from '@/data/repositories/appSettingsRepo';
import type { AiExampleLevel } from '@/domain/prefs';
import {
  DEFAULT_DAILY_REVIEW_LIMIT,
  DEFAULT_NEW_CARDS_PER_SESSION,
} from '@/domain/scheduling/constants';
import {
  clampDailyReviewLimit,
  clampNewCardsPerSession,
} from '@/domain/scheduling/sessionQueue';

type DeckPrefs = {
  secondaryLanguage?: string | null;
  exampleLevel?: AiExampleLevel | null;
  studyReversed?: boolean;
  showExamplesOnFront?: boolean;
  showExamplesOnBack?: boolean;
  newCardsPerSession?: number;
  dailyReviewLimit?: number;
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
    studyReversed: typeof obj.studyReversed === 'boolean' ? obj.studyReversed : false,
    showExamplesOnFront:
      typeof obj.showExamplesOnFront === 'boolean' ? obj.showExamplesOnFront : true,
    showExamplesOnBack:
      typeof obj.showExamplesOnBack === 'boolean' ? obj.showExamplesOnBack : true,
    newCardsPerSession:
      typeof obj.newCardsPerSession === 'number'
        ? clampNewCardsPerSession(obj.newCardsPerSession)
        : DEFAULT_NEW_CARDS_PER_SESSION,
    dailyReviewLimit:
      typeof obj.dailyReviewLimit === 'number'
        ? clampDailyReviewLimit(obj.dailyReviewLimit)
        : DEFAULT_DAILY_REVIEW_LIMIT,
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

export async function getStudyReversed(deckId: string): Promise<boolean> {
  const prefs = await getDeckPrefs(deckId);
  return !!prefs.studyReversed;
}

export async function setStudyReversed(deckId: string, value: boolean): Promise<void> {
  const prefs = await getDeckPrefs(deckId);
  const next: DeckPrefs = {
    ...prefs,
    studyReversed: !!value,
  };
  await appSettingsRepo.setSetting(key(deckId), JSON.stringify(next));
}

export async function getShowExamplesOnFront(deckId: string): Promise<boolean> {
  const prefs = await getDeckPrefs(deckId);
  return prefs.showExamplesOnFront ?? true;
}

export async function setShowExamplesOnFront(deckId: string, value: boolean): Promise<void> {
  const prefs = await getDeckPrefs(deckId);
  const next: DeckPrefs = {
    ...prefs,
    showExamplesOnFront: !!value,
  };
  await appSettingsRepo.setSetting(key(deckId), JSON.stringify(next));
}

export async function getShowExamplesOnBack(deckId: string): Promise<boolean> {
  const prefs = await getDeckPrefs(deckId);
  return prefs.showExamplesOnBack ?? true;
}

export async function setShowExamplesOnBack(deckId: string, value: boolean): Promise<void> {
  const prefs = await getDeckPrefs(deckId);
  const next: DeckPrefs = {
    ...prefs,
    showExamplesOnBack: !!value,
  };
  await appSettingsRepo.setSetting(key(deckId), JSON.stringify(next));
}

export async function getNewCardsPerSession(deckId: string): Promise<number> {
  const prefs = await getDeckPrefs(deckId);
  return clampNewCardsPerSession(prefs.newCardsPerSession ?? DEFAULT_NEW_CARDS_PER_SESSION);
}

export async function setNewCardsPerSession(deckId: string, value: number): Promise<void> {
  const prefs = await getDeckPrefs(deckId);
  const next: DeckPrefs = {
    ...prefs,
    newCardsPerSession: clampNewCardsPerSession(value),
  };
  await appSettingsRepo.setSetting(key(deckId), JSON.stringify(next));
}

export async function getDailyReviewLimit(deckId: string): Promise<number> {
  const prefs = await getDeckPrefs(deckId);
  return clampDailyReviewLimit(prefs.dailyReviewLimit ?? DEFAULT_DAILY_REVIEW_LIMIT);
}

export async function setDailyReviewLimit(deckId: string, value: number): Promise<void> {
  const prefs = await getDeckPrefs(deckId);
  const next: DeckPrefs = {
    ...prefs,
    dailyReviewLimit: clampDailyReviewLimit(value),
  };
  await appSettingsRepo.setSetting(key(deckId), JSON.stringify(next));
}

export async function deleteDeckPrefs(deckId: string): Promise<void> {
  await appSettingsRepo.deleteSetting(key(deckId));
}
