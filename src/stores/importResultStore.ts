import { create } from 'zustand';

export type ImportResult = {
  deckId: string;
  created: number;
  skippedInvalid: number;
  skippedDuplicates: number;
  examplesTotal: number;
  examplesDone: number;
  examplesFailed: number;
  examplesCancelled: number;
  examplesFailureSummary: string;
};

type ImportResultState = {
  byDeckId: Record<string, ImportResult>;
  setResult: (result: ImportResult) => void;
  consumeResult: (deckId: string) => ImportResult | null;
};

export const useImportResultStore = create<ImportResultState>((set, get) => ({
  byDeckId: {},
  setResult: (result) =>
    set((state) => ({
      byDeckId: { ...state.byDeckId, [result.deckId]: result },
    })),
  consumeResult: (deckId) => {
    const existing = get().byDeckId[deckId] ?? null;
    if (!existing) return null;
    set((state) => {
      const next = { ...state.byDeckId };
      delete next[deckId];
      return { byDeckId: next };
    });
    return existing;
  },
}));
