import { create } from 'zustand';

import type { Deck } from '@/domain/models';
import * as decksRepo from '@/data/repositories/decksRepo';

type DecksState = {
  decks: Deck[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createDeck: (name: string, accentColor?: string) => Promise<Deck | null>;
  updateDeck: (
    deckId: string,
    patch: Partial<Pick<Deck, 'name' | 'accentColor'>>,
  ) => Promise<void>;
  deleteDeck: (deckId: string) => Promise<void>;
};

export const useDecksStore = create<DecksState>((set, get) => ({
  decks: [],
  loading: false,
  error: null,

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const decks = await decksRepo.listDecks();
      set({ decks, loading: false });
    } catch (e: any) {
      set({ loading: false, error: e?.message ?? 'Failed to load decks.' });
    }
  },

  createDeck: async (name: string, accentColor?: string) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    try {
      const deck = accentColor
        ? await decksRepo.createDeckWithAccent({ name: trimmed, accentColor })
        : await decksRepo.createDeck(trimmed);
      // Optimistic append with updated ordering.
      set({ decks: [deck, ...get().decks] });
      return deck;
    } catch (e: any) {
      set({ error: e?.message ?? 'Failed to create deck.' });
      return null;
    }
  },

  updateDeck: async (deckId, patch) => {
    try {
      await decksRepo.updateDeck(deckId, patch);
      await get().refresh();
    } catch (e: any) {
      set({ error: e?.message ?? 'Failed to update deck.' });
    }
  },

  deleteDeck: async (deckId: string) => {
    try {
      await decksRepo.deleteDeck(deckId);
      set({ decks: get().decks.filter((d) => d.id !== deckId) });
    } catch (e: any) {
      set({ error: e?.message ?? 'Failed to delete deck.' });
    }
  },
}));
