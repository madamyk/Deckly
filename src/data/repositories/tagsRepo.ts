import { getDb } from '@/data/db';
import { nowMs } from '@/utils/time';

function normalizeTagName(tag: string): string {
  return tag.trim().replace(/\s+/g, ' ');
}

function normalizeTagList(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const name = normalizeTagName(raw);
    if (!name) continue;
    const key = name.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

export async function listAllTags(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ name: string }>(
    'SELECT name FROM tags ORDER BY name COLLATE NOCASE ASC;',
  );
  return rows.map((r) => String(r.name));
}

export async function createTag(tag: string): Promise<void> {
  const db = await getDb();
  const now = nowMs();
  const name = normalizeTagName(tag);
  if (!name) return;
  await db.runAsync('INSERT OR IGNORE INTO tags (name, createdAt) VALUES (?, ?);', [name, now]);
}

export async function removeTagEverywhere(tag: string): Promise<void> {
  const db = await getDb();
  const name = normalizeTagName(tag);
  if (!name) return;
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM deck_tags WHERE tagName = ?;', [name]);
    await txn.runAsync('DELETE FROM tags WHERE name = ?;', [name]);
  });
}

export async function getDeckTags(deckId: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ tagName: string }>(
    'SELECT tagName FROM deck_tags WHERE deckId = ? ORDER BY tagName COLLATE NOCASE ASC;',
    [deckId],
  );
  return rows.map((r) => String(r.tagName));
}

export async function setDeckTags(deckId: string, tags: string[]): Promise<void> {
  const db = await getDb();
  const now = nowMs();
  const normalized = normalizeTagList(tags);

  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const tag of normalized) {
      await txn.runAsync('INSERT OR IGNORE INTO tags (name, createdAt) VALUES (?, ?);', [tag, now]);
    }

    await txn.runAsync('DELETE FROM deck_tags WHERE deckId = ?;', [deckId]);
    for (const tag of normalized) {
      await txn.runAsync(
        'INSERT OR REPLACE INTO deck_tags (deckId, tagName, createdAt) VALUES (?, ?, ?);',
        [deckId, tag, now],
      );
    }
  });
}

export async function listTagsWithDueCounts(now = nowMs()): Promise<
  { tag: string; due: number; deckCount: number }[]
> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ tag: string; due: number; deckCount: number }>(
    `
    SELECT
      t.name AS tag,
      SUM(CASE WHEN c.id IS NOT NULL AND c.deletedAt IS NULL AND c.dueAt <= ? THEN 1 ELSE 0 END) AS due,
      COUNT(DISTINCT dt.deckId) AS deckCount
    FROM tags t
    JOIN deck_tags dt ON dt.tagName = t.name
    JOIN decks d ON d.id = dt.deckId AND d.deletedAt IS NULL
    LEFT JOIN cards c ON c.deckId = dt.deckId
    GROUP BY t.name
    ORDER BY t.name COLLATE NOCASE ASC;
  `,
    [now],
  );
  return rows.map((r) => ({
    tag: String(r.tag),
    due: Number(r.due ?? 0),
    deckCount: Number(r.deckCount ?? 0),
  }));
}

export async function listDeckIdsByTag(tag: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ deckId: string }>(
    `
    SELECT dt.deckId
    FROM deck_tags dt
    JOIN decks d ON d.id = dt.deckId
    WHERE dt.tagName = ?
      AND d.deletedAt IS NULL
    ORDER BY d.updatedAt DESC;
  `,
    [normalizeTagName(tag)],
  );
  return rows.map((r) => String(r.deckId));
}
