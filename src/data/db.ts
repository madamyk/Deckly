import * as SQLite from 'expo-sqlite';

export type DecklyDb = SQLite.SQLiteDatabase;

let dbPromise: Promise<DecklyDb> | null = null;

// Dev-time schema version. If it changes, we reset the local DB (wipe all local data).
const SCHEMA_VERSION = 3;

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

async function resetToSchema(db: DecklyDb): Promise<void> {
  await db.execAsync('BEGIN;');
  try {
    await db.execAsync('DROP TABLE IF EXISTS cards;');
    await db.execAsync('DROP TABLE IF EXISTS decks;');
    await db.execAsync('DROP TABLE IF EXISTS app_settings;');

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS decks (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        accentColor TEXT NOT NULL,
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

        -- Bilingual example pair (offline persisted)
        exampleL1 TEXT,
        exampleL2 TEXT,
        exampleNote TEXT,
        exampleSource TEXT, -- "user" | "ai" | NULL
        exampleGeneratedAt INTEGER,

        -- Scheduling
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

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);

    await db.execAsync('CREATE INDEX IF NOT EXISTS idx_cards_deck_due ON cards(deckId, dueAt);');
    await db.execAsync(
      'CREATE INDEX IF NOT EXISTS idx_cards_deck_updated ON cards(deckId, updatedAt);',
    );
    await db.execAsync(
      'CREATE INDEX IF NOT EXISTS idx_cards_deck_state ON cards(deckId, state);',
    );

    await setUserVersion(db, SCHEMA_VERSION);
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
  if (version !== SCHEMA_VERSION) {
    await resetToSchema(db);
  }
}
