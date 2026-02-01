export type ReviewPrefs = {
  showExamplesOnFront: boolean;
  showExamplesOnBack: boolean;
  examplesCollapsedByDefault: boolean;
};

export type AiExampleLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type AiExampleDomain = 'daily' | 'travel' | 'work' | 'neutral';

export type AiPrefs = {
  enabled: boolean;
  provider: 'openai';
  model: string;
  level: AiExampleLevel;
  domain: AiExampleDomain;
};

export type AppPrefs = {
  review: ReviewPrefs;
  ai: AiPrefs;
};

export const DEFAULT_PREFS: AppPrefs = {
  review: {
    showExamplesOnFront: true,
    showExamplesOnBack: true,
    examplesCollapsedByDefault: true,
  },
  ai: {
    enabled: false,
    provider: 'openai',
    // Keep as a string so users can adjust to whatever their account supports.
    model: 'gpt-4.1-mini',
    level: 'B1',
    domain: 'daily',
  },
};
