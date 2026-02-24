import * as SQLite from 'expo-sqlite';

export type DecklyDb = SQLite.SQLiteDatabase;

let dbPromise: Promise<DecklyDb> | null = null;

// Production-safe schema versioning: migrate forward, never wipe user data.
const SCHEMA_VERSION = 5;

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

async function ensureCoreSchema(db: DecklyDb): Promise<void> {
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
      exampleFront TEXT,
      exampleBack TEXT,
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
  await db.execAsync('CREATE INDEX IF NOT EXISTS idx_cards_deck_state ON cards(deckId, state);');
}

async function migrateToV4AddTags(db: DecklyDb): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS tags (
      name TEXT PRIMARY KEY NOT NULL COLLATE NOCASE,
      createdAt INTEGER NOT NULL
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS deck_tags (
      deckId TEXT NOT NULL,
      tagName TEXT NOT NULL COLLATE NOCASE,
      createdAt INTEGER NOT NULL,
      PRIMARY KEY (deckId, tagName),
      FOREIGN KEY(deckId) REFERENCES decks(id),
      FOREIGN KEY(tagName) REFERENCES tags(name)
    );
  `);

  await db.execAsync('CREATE INDEX IF NOT EXISTS idx_deck_tags_tag ON deck_tags(tagName, deckId);');
}

async function migrateToV5RenameCardExampleColumns(db: DecklyDb): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(cards);');
  const columnNames = new Set(columns.map((column) => String(column.name)));

  if (columnNames.has('exampleL1') && !columnNames.has('exampleFront')) {
    await db.execAsync('ALTER TABLE cards RENAME COLUMN exampleL1 TO exampleFront;');
  }

  if (columnNames.has('exampleL2') && !columnNames.has('exampleBack')) {
    await db.execAsync('ALTER TABLE cards RENAME COLUMN exampleL2 TO exampleBack;');
  }
}

async function migrate(db: DecklyDb, fromVersion: number): Promise<void> {
  await db.execAsync('BEGIN;');
  try {
    // Fresh install.
    if (fromVersion === 0) {
      await ensureCoreSchema(db);
      await migrateToV4AddTags(db);
      await migrateToV5RenameCardExampleColumns(db);
      await setUserVersion(db, SCHEMA_VERSION);
      await db.execAsync('COMMIT;');
      return;
    }

    // Always ensure base tables/indexes exist.
    await ensureCoreSchema(db);

    if (fromVersion < 4) {
      await migrateToV4AddTags(db);
    }
    if (fromVersion < 5) {
      await migrateToV5RenameCardExampleColumns(db);
    }

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
  if (version < SCHEMA_VERSION) {
    await migrate(db, version);
  }
}
