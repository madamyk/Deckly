import { getDb } from '@/data/db';
import type { Card, CardState, ExampleSource } from '@/domain/models';
import type { CardPatch } from '@/domain/scheduling/schedule';
import { makeId } from '@/utils/id';
import { nowMs } from '@/utils/time';

function mapCardRow(row: any): Card {
  return {
    id: String(row.id),
    deckId: String(row.deckId),
    front: String(row.front),
    back: String(row.back),
    exampleL1: row.exampleL1 == null ? null : String(row.exampleL1),
    exampleL2: row.exampleL2 == null ? null : String(row.exampleL2),
    exampleNote: row.exampleNote == null ? null : String(row.exampleNote),
    exampleSource: row.exampleSource == null ? null : (String(row.exampleSource) as ExampleSource),
    exampleGeneratedAt: row.exampleGeneratedAt == null ? null : Number(row.exampleGeneratedAt),

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
      AND (front LIKE ? OR back LIKE ? OR exampleL1 LIKE ? OR exampleL2 LIKE ? OR exampleNote LIKE ?)
    ORDER BY updatedAt DESC;
  `,
    [deckId, like, like, like, like, like],
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
  exampleL1?: string | null;
  exampleL2?: string | null;
  exampleNote?: string | null;
  exampleSource?: ExampleSource | null;
  exampleGeneratedAt?: number | null;
}): Promise<Card> {
  const db = await getDb();
  const now = nowMs();
  const card: Card = {
    id: makeId(),
    deckId: params.deckId,
    front: params.front.trim(),
    back: params.back.trim(),
    exampleL1: params.exampleL1?.trim() || null,
    exampleL2: params.exampleL2?.trim() || null,
    exampleNote: params.exampleNote?.trim() || null,
    exampleSource: params.exampleSource ?? null,
    exampleGeneratedAt: params.exampleGeneratedAt ?? null,
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
      id, deckId, front, back,
      exampleL1, exampleL2, exampleNote, exampleSource, exampleGeneratedAt,
      state, dueAt, intervalDays, ease, reps, lapses, learningStepIndex,
      createdAt, updatedAt, deletedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL);
  `,
    [
      card.id,
      card.deckId,
      card.front,
      card.back,
      card.exampleL1,
      card.exampleL2,
      card.exampleNote,
      card.exampleSource,
      card.exampleGeneratedAt,
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
  patch: Partial<
    Pick<
      Card,
      'front' | 'back' | 'exampleL1' | 'exampleL2' | 'exampleNote' | 'exampleSource' | 'exampleGeneratedAt'
    >
  >,
): Promise<void> {
  const db = await getDb();
  const now = nowMs();

  const current = await getCard(cardId);
  if (!current) return;

  const front = patch.front != null ? patch.front.trim() : current.front;
  const back = patch.back != null ? patch.back.trim() : current.back;
  const exampleL1 =
    patch.exampleL1 != null
      ? (patch.exampleL1.trim() ? patch.exampleL1.trim() : null)
      : current.exampleL1;
  const exampleL2 =
    patch.exampleL2 != null
      ? (patch.exampleL2.trim() ? patch.exampleL2.trim() : null)
      : current.exampleL2;
  const exampleNote =
    patch.exampleNote != null
      ? (patch.exampleNote.trim() ? patch.exampleNote.trim() : null)
      : current.exampleNote;
  const exampleSource = patch.exampleSource !== undefined ? patch.exampleSource : current.exampleSource;
  const exampleGeneratedAt =
    patch.exampleGeneratedAt !== undefined ? patch.exampleGeneratedAt : current.exampleGeneratedAt;

  await db.runAsync(
    `
    UPDATE cards
    SET front = ?,
        back = ?,
        exampleL1 = ?,
        exampleL2 = ?,
        exampleNote = ?,
        exampleSource = ?,
        exampleGeneratedAt = ?,
        updatedAt = ?
    WHERE id = ?;
  `,
    [front, back, exampleL1, exampleL2, exampleNote, exampleSource, exampleGeneratedAt, now, cardId],
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
  items: {
    id: string;
    front: string;
    back: string;
    exampleL1?: string | null;
    exampleL2?: string | null;
    exampleNote?: string | null;
    exampleSource?: ExampleSource | null;
    exampleGeneratedAt?: number | null;
  }[];
}): Promise<{ created: number; createdIds: string[] }> {
  const db = await getDb();
  const now = nowMs();
  let created = 0;
  const createdIds: string[] = [];

  await db.withExclusiveTransactionAsync(async (txn) => {
    const stmt = await txn.prepareAsync(
      `
      INSERT INTO cards (
        id, deckId, front, back,
        exampleL1, exampleL2, exampleNote, exampleSource, exampleGeneratedAt,
        state, dueAt, intervalDays, ease, reps, lapses, learningStepIndex,
        createdAt, updatedAt, deletedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL);
    `,
    );
    try {
      for (const item of params.items) {
        const front = item.front.trim();
        const back = item.back.trim();
        const exampleL1 = item.exampleL1?.trim() || null;
        const exampleL2 = item.exampleL2?.trim() || null;
        const exampleNote = item.exampleNote?.trim() || null;
        const exampleSource = item.exampleSource ?? null;
        const exampleGeneratedAt = item.exampleGeneratedAt ?? null;
        if (!front || !back) continue;

        await stmt.executeAsync([
          item.id,
          params.deckId,
          front,
          back,
          exampleL1,
          exampleL2,
          exampleNote,
          exampleSource,
          exampleGeneratedAt,
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
        createdIds.push(item.id);
      }
    } finally {
      await stmt.finalizeAsync();
    }
  });

  return { created, createdIds };
}
