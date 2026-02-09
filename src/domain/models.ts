export type CardState = 'new' | 'learning' | 'review';
export type ExampleSource = 'user' | 'ai';

export type Deck = {
  id: string;
  name: string;
  accentColor: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
};

export type Card = {
  id: string;
  deckId: string;
  front: string;
  back: string;
  exampleL1: string | null;
  exampleL2: string | null;
  exampleNote: string | null;
  exampleSource: ExampleSource | null;
  exampleGeneratedAt: number | null;

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
  mature: number;
};
