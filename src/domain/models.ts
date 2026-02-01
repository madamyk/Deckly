export type CardState = 'new' | 'learning' | 'review';

export type Deck = {
  id: string;
  name: string;
  accentColor: string | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
};

export type Card = {
  id: string;
  deckId: string;
  front: string;
  back: string;
  example: string | null;

  state: CardState;
  dueAt: number;
  intervalDays: number;
  ease: number;
  reps: number;
  lapses: number;
  learningStepIndex: number;

  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
};

export type DeckStats = {
  total: number;
  due: number;
  new: number;
  learning: number;
  review: number;
};
