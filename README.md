# Deckly

Portfolio-quality flashcards + spaced repetition app scaffold (offline-first).

## Tech
- Expo SDK 54 + React Native + TypeScript
- Navigation: `expo-router` (Stack)
- Persistence: SQLite via `expo-sqlite` (repositories; no AsyncStorage/MMKV for domain data)
- Sensitive storage (reserved): `expo-secure-store` (future AI key)
- State: Zustand (deck list)

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
  ai/                     # future AI Assist provider contract + disabled provider
  data/
    db.ts                 # SQLite open + migrations (PRAGMA user_version)
    repositories/         # deck/card repositories (all SQL lives here)
    secureStore.ts        # reserved for future secrets
  domain/
    models.ts             # Deck/Card types
    ratings.ts            # Again/Hard/Good/Easy
    scheduling/           # Anki-lite scheduling + tests
  stores/                 # Zustand stores
  ui/
    components/           # UI primitives (Button, Screen, FlipCard, etc.)
    screens/              # screen helpers (CardEditorScreen)
    theme/                # tokens + provider
```

## Data Model (SQLite)
Deckly uses integer timestamps in **milliseconds since epoch**.

Tables:
- `decks`: `id`, `name`, `createdAt`, `updatedAt`, `deletedAt`
- `cards`: `id`, `deckId`, `front`, `back`, `example`, plus scheduling fields:
  - `state`: `"new" | "learning" | "review"`
  - `dueAt`: integer ms timestamp
  - `intervalDays`: integer
  - `ease`: real (default `2.5`)
  - `reps`: integer
  - `lapses`: integer
  - `learningStepIndex`: integer
  - `createdAt`, `updatedAt`, `deletedAt`

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
- Map columns to `front`, `back`, and optionally `example`.
- Optional dedupe: skips rows with the same `(front + back)` already present in the deck.

## Tests
```bash
npm test
```

Scheduling tests live in `src/domain/scheduling/__tests__/schedule.test.ts`.

## Roadmap
- AI Assist enablement (provider selection + SecureStore API key entry)
- Optional sync-ready schema (server IDs + conflict strategy)
- Better import/export (CSV export + backups)
- Review options (daily limit, cram mode, randomization)
- FTS search for cards

