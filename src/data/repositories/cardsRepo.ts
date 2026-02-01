import { getDb } from '@/data/db';
import type { Card, CardState } from '@/domain/models';
import type { CardPatch } from '@/domain/scheduling/schedule';
import { makeId } from '@/utils/id';
import { nowMs } from '@/utils/time';

function mapCardRow(row: any): Card {
  return {
    id: String(row.id),
    deckId: String(row.deckId),
    front: String(row.front),
    back: String(row.back),
    example: row.example == null ? null : String(row.example),

    state: row.state as CardState,
    dueAt: Number(row.dueAt),
    intervalDays: Number(row.intervalDays),
    ease: Number(row.ease),
    reps: Number(row.reps),
    lapses: Number(row.lapses),
    learningStepIndex: Number(row.learningStepIndex),

    createdAt: Number(row.createdAt),
    updatedAt: Number(row.updatedAt),
    deletedAt: row.deletedAt == null ? null : Number(row.deletedAt),
  };
}

export async function listCards(deckId: string, query?: string): Promise<Card[]> {
  const db = await getDb();
  const q = query?.trim();
  if (!q) {
    const rows = await db.getAllAsync(
      'SELECT * FROM cards WHERE deckId = ? AND deletedAt IS NULL ORDER BY updatedAt DESC;',
      [deckId],
    );
    return rows.map(mapCardRow);
  }
  const like = `%${q}%`;
  const rows = await db.getAllAsync(
    `
    SELECT * FROM cards
    WHERE deckId = ?
      AND deletedAt IS NULL
      AND (front LIKE ? OR back LIKE ? OR example LIKE ?)
    ORDER BY updatedAt DESC;
  `,
    [deckId, like, like, like],
  );
  return rows.map(mapCardRow);
}

export async function getCard(cardId: string): Promise<Card | null> {
  const db = await getDb();
  const row = await db.getFirstAsync('SELECT * FROM cards WHERE id = ?;', [cardId]);
  return row ? mapCardRow(row) : null;
}

export async function createCard(params: {
  deckId: string;
  front: string;
  back: string;
  example?: string | null;
}): Promise<Card> {
  const db = await getDb();
  const now = nowMs();
  const card: Card = {
    id: makeId(),
    deckId: params.deckId,
    front: params.front.trim(),
    back: params.back.trim(),
    example: params.example?.trim() || null,
    state: 'new',
    dueAt: now,
    intervalDays: 0,
    ease: 2.5,
    reps: 0,
    lapses: 0,
    learningStepIndex: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  await db.runAsync(
    `
    INSERT INTO cards (
      id, deckId, front, back, example,
      state, dueAt, intervalDays, ease, reps, lapses, learningStepIndex,
      createdAt, updatedAt, deletedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL);
  `,
    [
      card.id,
      card.deckId,
      card.front,
      card.back,
      card.example,
      card.state,
      card.dueAt,
      card.intervalDays,
      card.ease,
      card.reps,
      card.lapses,
      card.learningStepIndex,
      card.createdAt,
      card.updatedAt,
    ],
  );

  return card;
}

export async function updateCard(
  cardId: string,
  patch: Partial<Pick<Card, 'front' | 'back' | 'example'>>,
): Promise<void> {
  const db = await getDb();
  const now = nowMs();

  const current = await getCard(cardId);
  if (!current) return;

  const front = patch.front != null ? patch.front.trim() : current.front;
  const back = patch.back != null ? patch.back.trim() : current.back;
  const example =
    patch.example != null ? (patch.example.trim() ? patch.example.trim() : null) : current.example;

  await db.runAsync(
    'UPDATE cards SET front = ?, back = ?, example = ?, updatedAt = ? WHERE id = ?;',
    [front, back, example, now, cardId],
  );
}

export async function softDeleteCard(cardId: string): Promise<void> {
  const db = await getDb();
  const now = nowMs();
  await db.runAsync('UPDATE cards SET deletedAt = ?, updatedAt = ? WHERE id = ?;', [
    now,
    now,
    cardId,
  ]);
}

export async function getDueCards(params: {
  deckId: string;
  now?: number;
  limit?: number;
}): Promise<Card[]> {
  const db = await getDb();
  const now = params.now ?? nowMs();
  const limit = params.limit ?? 50;
  const rows = await db.getAllAsync(
    `
    SELECT * FROM cards
    WHERE deckId = ?
      AND deletedAt IS NULL
      AND dueAt <= ?
    ORDER BY dueAt ASC
    LIMIT ?;
  `,
    [params.deckId, now, limit],
  );
  return rows.map(mapCardRow);
}

export async function applyScheduling(cardId: string, patch: CardPatch): Promise<void> {
  const db = await getDb();

  const updates: string[] = [];
  const values: any[] = [];

  const add = (k: string, v: any) => {
    updates.push(`${k} = ?`);
    values.push(v);
  };

  if (patch.state != null) add('state', patch.state);
  if (patch.dueAt != null) add('dueAt', patch.dueAt);
  if (patch.intervalDays != null) add('intervalDays', patch.intervalDays);
  if (patch.ease != null) add('ease', patch.ease);
  if (patch.reps != null) add('reps', patch.reps);
  if (patch.lapses != null) add('lapses', patch.lapses);
  if (patch.learningStepIndex != null) add('learningStepIndex', patch.learningStepIndex);
  if (patch.updatedAt != null) add('updatedAt', patch.updatedAt);

  if (!updates.length) return;

  values.push(cardId);
  await db.runAsync(`UPDATE cards SET ${updates.join(', ')} WHERE id = ?;`, values);
}

export async function getCardKeySet(deckId: string): Promise<Set<string>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ front: string; back: string }>(
    'SELECT front, back FROM cards WHERE deckId = ? AND deletedAt IS NULL;',
    [deckId],
  );
  const set = new Set<string>();
  for (const r of rows) {
    // ASCII "unit separator" as a low-collision delimiter for a simple dedupe key.
    set.add(`${String(r.front)}\u001F${String(r.back)}`);
  }
  return set;
}

export async function createManyCards(params: {
  deckId: string;
  items: { front: string; back: string; example?: string | null }[];
}): Promise<{ created: number }> {
  const db = await getDb();
  const now = nowMs();
  let created = 0;

  await db.withExclusiveTransactionAsync(async (txn) => {
    const stmt = await txn.prepareAsync(
      `
      INSERT INTO cards (
        id, deckId, front, back, example,
        state, dueAt, intervalDays, ease, reps, lapses, learningStepIndex,
        createdAt, updatedAt, deletedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL);
    `,
    );
    try {
      for (const item of params.items) {
        const front = item.front.trim();
        const back = item.back.trim();
        const example = item.example?.trim() || null;
        if (!front || !back) continue;

        await stmt.executeAsync([
          makeId(),
          params.deckId,
          front,
          back,
          example,
          'new',
          now, // dueAt: new cards are due immediately
          0, // intervalDays
          2.5, // ease
          0, // reps
          0, // lapses
          0, // learningStepIndex
          now, // createdAt
          now, // updatedAt
        ]);
        created++;
      }
    } finally {
      await stmt.finalizeAsync();
    }
  });

  return { created };
}
