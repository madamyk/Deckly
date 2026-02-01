# Deckly

Portfolio-quality flashcards + spaced repetition app scaffold (offline-first).

## Tech
- Expo SDK 54 + React Native + TypeScript
- Navigation: `expo-router` (Stack)
- Persistence: SQLite via `expo-sqlite` (repositories; no AsyncStorage/MMKV for domain data)
- Sensitive storage: `expo-secure-store` (OpenAI API key)
- State: Zustand (decks + preferences)

## Run
```bash
npm install
npm run start
```

Then press:
- `i` for iOS simulator
- `a` for Android emulator

## App Structure
```
app/                      # expo-router routes (screens only)
src/
  ai/                     # AI helpers (prompt/parsing) + OpenAI fetch client
  data/
    db.ts                 # SQLite open + schema reset (PRAGMA user_version)
    repositories/         # deck/card repositories (all SQL lives here)
    secureStore.ts        # OpenAI API key (SecureStore)
  domain/
    models.ts             # Deck/Card types (incl. bilingual examples)
    prefs.ts              # app prefs types + defaults
    ratings.ts            # Again/Hard/Good/Easy
    scheduling/           # Anki-lite scheduling + tests
  services/               # AI generation orchestration (business logic)
  stores/                 # Zustand stores
  ui/
    components/           # UI primitives (Button, Screen, FlipCard, etc.)
    screens/              # screen helpers (CardEditorScreen)
    theme/                # tokens + provider
```

## Data Model (SQLite)
Deckly uses integer timestamps in **milliseconds since epoch**.

Note (dev): when the schema version changes, Deckly resets the local SQLite DB (wipes local data) to keep the schema clean during rapid iteration.

Tables:
- `decks`: `id`, `name`, `accentColor`, `createdAt`, `updatedAt`, `deletedAt`
- `cards`: `id`, `deckId`, `front`, `back`,
  bilingual examples:
  - `exampleL1` (TEXT)
  - `exampleL2` (TEXT)
  - `exampleNote` (TEXT)
  - `exampleSource` (`"user" | "ai" | NULL`)
  - `exampleGeneratedAt` (INTEGER ms)
  plus scheduling fields:
  - `state`: `"new" | "learning" | "review"`
  - `dueAt`: integer ms timestamp
  - `intervalDays`: integer
  - `ease`: real (default `2.5`)
  - `reps`: integer
  - `lapses`: integer
  - `learningStepIndex`: integer
  - `createdAt`, `updatedAt`, `deletedAt`
- `app_settings`: simple KV store for non-sensitive app prefs

Indices:
- `idx_cards_deck_due (deckId, dueAt)`

## Scheduling Overview (Anki-lite / SM-2-ish)
Implemented as a pure function:
`schedule(card, rating, nowMs) -> updatedCardPatch` in `src/domain/scheduling/schedule.ts`.

Learning steps (defaults):
- `[10 minutes, 1 day]` (see `src/domain/scheduling/constants.ts`)

Rules summary:
- `new`:
  - `easy` -> graduate to `review` (2d)
  - otherwise -> enter `learning` (step 0 or 1)
- `learning`:
  - `again` -> step 0 (10m)
  - `hard` -> repeat current step (design choice)
  - `good` -> next step; after last step -> graduate to `review` (2d)
  - `easy` -> graduate early
- `review`:
  - `again` -> lapse: `lapses++`, `ease -= 0.2` (min 1.3), back to `learning` step 0 (10m)
  - `hard` -> `ease -= 0.15`, `intervalDays *= 1.2`
  - `good` -> `intervalDays *= ease`
  - `easy` -> `ease += 0.15` (max 3.0), `intervalDays *= ease * 1.3`

## CSV Import
Flow: pick file -> preview -> map columns -> import.

Guidance:
- CSV can include headers (toggle in the import UI).
- Map columns to `front`, `back`, and optionally example `front` / example `back`.
- Optional dedupe: skips rows with the same `(front + back)` already present in the deck.

## Optional AI Example Generation (BYO OpenAI Key)
Deckly can generate bilingual example sentence pairs (front language + back language) and store them in SQLite for offline review.

How it works:
- AI features are OFF by default.
- Enable AI Assist and add your OpenAI API key in `Settings -> AI Assist` (stored via `expo-secure-store` on-device).
- Languages are inferred from each card's Front/Back text (no per-language settings).
- During CSV import you can:
  - generate missing examples, or
  - regenerate all examples (with confirmation).
- In the Card Editor you can generate a pair for a single card and edit before saving.
- Review screen can show/hide examples based on Settings, plus has an in-session toggle.

Cost note:
- Requests go directly to OpenAI using your key and may cost money depending on model and account.

### Dev: seed API key from env
For local development only, you can seed SecureStore from an environment variable:

```bash
DECKLY_DEV_OPENAI_API_KEY="sk-..." npm run start
```

This runs only in `__DEV__` and only if SecureStore doesn't already have a key.
Do not use this for production builds (anything in Expo config `extra` can end up in the JS bundle).

## Tests
```bash
npm test
```

Tests:
- Scheduling: `src/domain/scheduling/__tests__/schedule.test.ts`
- AI prompt/parsing: `src/ai/__tests__/examplePairs.test.ts`

## Roadmap
- Optional sync-ready schema (server IDs + conflict strategy)
- Better import/export (CSV export + backups)
- Review options (daily limit, cram mode, randomization)
- FTS search for cards
