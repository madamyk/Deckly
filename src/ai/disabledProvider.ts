import type { AiAssistProvider } from '@/ai/types';

export class AiAssistDisabledError extends Error {
  constructor() {
    super('AI Assist is disabled in this build (coming soon).');
    this.name = 'AiAssistDisabledError';
  }
}

export const disabledAiAssistProvider: AiAssistProvider = {
  async explainCard() {
    throw new AiAssistDisabledError();
  },
  async generateExample() {
    throw new AiAssistDisabledError();
  },
  async generateExamplePair() {
    throw new AiAssistDisabledError();
  },
};
