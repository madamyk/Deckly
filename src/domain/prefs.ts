export type ReviewPrefs = {
  showExamplesOnFront: boolean;
  showExamplesOnBack: boolean;
  examplesCollapsedByDefault: boolean;
};

export type AiExampleLevel = 'easy' | 'medium' | 'advanced';
export type AiReasoningEffort = 'low' | 'medium' | 'high';
export type AiPrefs = {
  enabled: boolean;
  provider: 'openai';
  model: string;
  level: AiExampleLevel;
  reasoningEffort: AiReasoningEffort;
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
    model: 'gpt-5',
    level: 'medium',
    reasoningEffort: 'low',
  },
};
