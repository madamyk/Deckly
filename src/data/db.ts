import * as SQLite from 'expo-sqlite';

export type DecklyDb = SQLite.SQLiteDatabase;

let dbPromise: Promise<DecklyDb> | null = null;

export async function getDb(): Promise<DecklyDb> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('deckly.db');
  }
  return dbPromise;
}

async function getUserVersion(db: DecklyDb): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  return row?.user_version ?? 0;
}

async function setUserVersion(db: DecklyDb, v: number): Promise<void> {
  await db.execAsync(`PRAGMA user_version = ${v};`);
}

async function hasColumn(db: DecklyDb, table: string, column: string): Promise<boolean> {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table});`);
  return rows.some((r) => String(r.name) === column);
}

async function migrateToV1(db: DecklyDb): Promise<void> {
  await db.execAsync('BEGIN;');
  try {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS decks (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        accentColor TEXT,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        deletedAt INTEGER
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS cards (
        id TEXT PRIMARY KEY NOT NULL,
        deckId TEXT NOT NULL,
        front TEXT NOT NULL,
        back TEXT NOT NULL,
        example TEXT,

        state TEXT NOT NULL,
        dueAt INTEGER NOT NULL,
        intervalDays INTEGER NOT NULL DEFAULT 0,
        ease REAL NOT NULL DEFAULT 2.5,
        reps INTEGER NOT NULL DEFAULT 0,
        lapses INTEGER NOT NULL DEFAULT 0,
        learningStepIndex INTEGER NOT NULL DEFAULT 0,

        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        deletedAt INTEGER,

        FOREIGN KEY(deckId) REFERENCES decks(id)
      );
    `);

    await db.execAsync(
      'CREATE INDEX IF NOT EXISTS idx_cards_deck_due ON cards(deckId, dueAt);',
    );
    await db.execAsync(
      'CREATE INDEX IF NOT EXISTS idx_cards_deck_updated ON cards(deckId, updatedAt);',
    );

    await setUserVersion(db, 1);
    await db.execAsync('COMMIT;');
  } catch (e) {
    await db.execAsync('ROLLBACK;');
    throw e;
  }
}

async function migrateToV2(db: DecklyDb): Promise<void> {
  // Ensure new columns exist even if the DB was created by an older schema.
  await db.execAsync('BEGIN;');
  try {
    if (!(await hasColumn(db, 'decks', 'accentColor'))) {
      await db.execAsync('ALTER TABLE decks ADD COLUMN accentColor TEXT;');
    }
    await setUserVersion(db, 2);
    await db.execAsync('COMMIT;');
  } catch (e) {
    await db.execAsync('ROLLBACK;');
    throw e;
  }
}

export async function initDb(): Promise<void> {
  const db = await getDb();
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await db.execAsync('PRAGMA journal_mode = WAL;');

  const version = await getUserVersion(db);
  if (version < 1) {
    await migrateToV1(db);
  }
  if (version < 2) {
    await migrateToV2(db);
  }
}
