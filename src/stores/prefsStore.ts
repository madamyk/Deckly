import { create } from 'zustand';

import type { AppPrefs } from '@/domain/prefs';
import { DEFAULT_PREFS } from '@/domain/prefs';
import * as appSettingsRepo from '@/data/repositories/appSettingsRepo';

const KEY = 'prefs.v1';

function safeParse(json: string): any {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function mergePrefs(partial: any): AppPrefs {
  const p = partial ?? {};
  return {
    review: {
      showExamplesOnFront:
        typeof p?.review?.showExamplesOnFront === 'boolean'
          ? p.review.showExamplesOnFront
          : DEFAULT_PREFS.review.showExamplesOnFront,
      showExamplesOnBack:
        typeof p?.review?.showExamplesOnBack === 'boolean'
          ? p.review.showExamplesOnBack
          : DEFAULT_PREFS.review.showExamplesOnBack,
      examplesCollapsedByDefault:
        typeof p?.review?.examplesCollapsedByDefault === 'boolean'
          ? p.review.examplesCollapsedByDefault
          : DEFAULT_PREFS.review.examplesCollapsedByDefault,
    },
    ai: {
      enabled: typeof p?.ai?.enabled === 'boolean' ? p.ai.enabled : DEFAULT_PREFS.ai.enabled,
      provider: 'openai',
      model: typeof p?.ai?.model === 'string' && p.ai.model.trim() ? p.ai.model.trim() : DEFAULT_PREFS.ai.model,
      level:
        p?.ai?.level === 'easy' ||
        p?.ai?.level === 'medium' ||
        p?.ai?.level === 'advanced'
          ? p.ai.level
          : DEFAULT_PREFS.ai.level,
    },
  };
}

type PrefsState = {
  loaded: boolean;
  prefs: AppPrefs;
  load: () => Promise<void>;
  setPrefs: (next: AppPrefs) => Promise<void>;
  patchPrefs: (patch: DeepPartial<AppPrefs>) => Promise<void>;
};

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export const usePrefsStore = create<PrefsState>((set, get) => ({
  loaded: false,
  prefs: DEFAULT_PREFS,

  load: async () => {
    const raw = await appSettingsRepo.getSetting(KEY);
    const parsed = raw ? safeParse(raw) : null;
    set({ prefs: mergePrefs(parsed), loaded: true });
  },

  setPrefs: async (next) => {
    set({ prefs: next });
    await appSettingsRepo.setSetting(KEY, JSON.stringify(next));
  },

  patchPrefs: async (patch) => {
    const current = get().prefs;
    const merged: AppPrefs = {
      review: { ...current.review, ...(patch.review ?? {}) },
      ai: { ...current.ai, ...(patch.ai ?? {}) },
    };
    await get().setPrefs(merged);
  },
}));
