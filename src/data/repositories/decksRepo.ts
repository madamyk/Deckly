import { getDb } from '@/data/db';
import type { Deck, DeckStats } from '@/domain/models';
import { pickRandomDeckAccentKey } from '@/domain/decks/accent';
import { deleteDeckLanguages } from '@/data/repositories/deckAiRepo';
import { makeId } from '@/utils/id';
import { nowMs } from '@/utils/time';

function mapDeckRow(row: any): Deck {
  return {
    id: String(row.id),
    name: String(row.name),
    accentColor: String(row.accentColor),
    createdAt: Number(row.createdAt),
    updatedAt: Number(row.updatedAt),
    deletedAt: row.deletedAt == null ? null : Number(row.deletedAt),
  };
}

export async function listDecks(): Promise<Deck[]> {
  const db = await getDb();
  const rows = await db.getAllAsync(
    'SELECT * FROM decks WHERE deletedAt IS NULL ORDER BY updatedAt DESC;',
  );
  return rows.map(mapDeckRow);
}

export async function getDeck(deckId: string): Promise<Deck | null> {
  const db = await getDb();
  const row = await db.getFirstAsync('SELECT * FROM decks WHERE id = ?;', [deckId]);
  return row ? mapDeckRow(row) : null;
}

export async function createDeck(name: string): Promise<Deck> {
  const db = await getDb();
  const now = nowMs();
  const deck: Deck = {
    id: makeId(),
    name: name.trim(),
    accentColor: pickRandomDeckAccentKey(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await db.runAsync(
    'INSERT INTO decks (id, name, accentColor, createdAt, updatedAt, deletedAt) VALUES (?, ?, ?, ?, ?, NULL);',
    [deck.id, deck.name, deck.accentColor, deck.createdAt, deck.updatedAt],
  );
  return deck;
}

export async function createDeckWithAccent(params: {
  name: string;
  accentColor: string;
}): Promise<Deck> {
  const db = await getDb();
  const now = nowMs();
  const deck: Deck = {
    id: makeId(),
    name: params.name.trim(),
    accentColor: params.accentColor,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await db.runAsync(
    'INSERT INTO decks (id, name, accentColor, createdAt, updatedAt, deletedAt) VALUES (?, ?, ?, ?, ?, NULL);',
    [deck.id, deck.name, deck.accentColor, deck.createdAt, deck.updatedAt],
  );
  return deck;
}

export async function updateDeck(
  deckId: string,
  patch: Partial<Pick<Deck, 'name' | 'accentColor'>>,
): Promise<void> {
  const db = await getDb();
  const now = nowMs();
  const updates: string[] = [];
  const values: any[] = [];
  const add = (k: string, v: any) => {
    updates.push(`${k} = ?`);
    values.push(v);
  };

  if (patch.name != null) add('name', patch.name.trim());
  if (patch.accentColor !== undefined) add('accentColor', patch.accentColor);
  add('updatedAt', now);

  values.push(deckId);
  await db.runAsync(`UPDATE decks SET ${updates.join(', ')} WHERE id = ?;`, values);
}

export async function deleteDeck(deckId: string): Promise<void> {
  const db = await getDb();
  const now = nowMs();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE decks SET deletedAt = ?, updatedAt = ? WHERE id = ?;', [
      now,
      now,
      deckId,
    ]);
    await db.runAsync(
      'UPDATE cards SET deletedAt = ?, updatedAt = ? WHERE deckId = ? AND deletedAt IS NULL;',
      [now, now, deckId],
    );
  });
  await deleteDeckLanguages(deckId);
}

export async function getDeckStats(deckId: string, now = nowMs()): Promise<DeckStats> {
  const db = await getDb();
  const totalRow = await db.getFirstAsync<{ c: number }>(
    'SELECT COUNT(*) AS c FROM cards WHERE deckId = ? AND deletedAt IS NULL;',
    [deckId],
  );
  const dueRow = await db.getFirstAsync<{ c: number }>(
    'SELECT COUNT(*) AS c FROM cards WHERE deckId = ? AND deletedAt IS NULL AND dueAt <= ?;',
    [deckId, now],
  );
  const newRow = await db.getFirstAsync<{ c: number }>(
    "SELECT COUNT(*) AS c FROM cards WHERE deckId = ? AND deletedAt IS NULL AND state = 'new';",
    [deckId],
  );
  const learningRow = await db.getFirstAsync<{ c: number }>(
    "SELECT COUNT(*) AS c FROM cards WHERE deckId = ? AND deletedAt IS NULL AND state = 'learning';",
    [deckId],
  );
  const reviewRow = await db.getFirstAsync<{ c: number }>(
    "SELECT COUNT(*) AS c FROM cards WHERE deckId = ? AND deletedAt IS NULL AND state = 'review';",
    [deckId],
  );

  return {
    total: Number(totalRow?.c ?? 0),
    due: Number(dueRow?.c ?? 0),
    new: Number(newRow?.c ?? 0),
    learning: Number(learningRow?.c ?? 0),
    review: Number(reviewRow?.c ?? 0),
  };
}
