# Deckly

AI-assisted flashcard app for faster learning

Deckly is an offline-first flashcards app with spaced repetition, bilingual examples, tagging, and per-deck review pacing. It ships as an Expo project ready for iOS, Android, and web.

## Features
- Spaced repetition with Anki-lite scheduling (Again/Hard/Good/Easy).
- Per-deck pacing: daily review limits and new-cards-per-session caps.
- Tagging: study by deck or tag; tag manager with pills and autocomplete.
- Bilingual examples and optional notes; toggle visibility during review.
- Optional AI-assisted example generation with your OpenAI key; generated pairs are stored locally for offline review.
- In-session chat about the current card so you can ask follow-up questions without copy/paste.
- CSV import with preview/mapping and deduping.
- Offline data in SQLite; no server dependency.

## Tech Stack
- Expo SDK 54, React Native, TypeScript
- Navigation: `expo-router`
- State: Zustand
- Storage: SQLite via `expo-sqlite`; secrets via `expo-secure-store`
- Styling: theme tokens + reusable UI components

## Getting Started
```bash
npm install
npm run start
```
When the Expo dev menu appears:
- press `i` for iOS simulator
- press `a` for Android emulator

## Project Structure
```
app/                      # expo-router screens
src/
  ai/                     # AI helpers (prompt/parsing) + OpenAI client
  data/
    db.ts                 # SQLite open + schema reset (PRAGMA user_version)
    repositories/         # SQL for decks/cards/tags/prefs
    secureStore.ts        # OpenAI key in SecureStore
  domain/
    models.ts             # deck/card types
    scheduling/           # SM-2-ish scheduler + tests
  services/               # AI orchestration
  stores/                 # Zustand stores
  ui/                     # components, screens helpers, theme
```

## Configuration
- AI (optional): add your OpenAI API key in Settings → AI Assist (stored locally).
- To seed a key in development only:
  ```bash
  DECKLY_DEV_OPENAI_API_KEY="sk-..." npm run start
  ```
  Runs only in `__DEV__` and only if SecureStore is empty.

## Data Model (SQLite)
- `decks`: id, name, accentColor, createdAt/updatedAt/deletedAt
- `cards`: deckId, front/back, exampleL1/exampleL2/exampleNote/exampleSource/exampleGeneratedAt, scheduling fields (state, dueAt, intervalDays, ease, reps, lapses, learningStepIndex, timestamps)
- `app_settings`: key/value for prefs and counters
- `deck_tags`: deckId, tagName

## Scheduling Overview
Pure function `schedule(card, rating, nowMs)` lives in `src/domain/scheduling/schedule.ts`.
Defaults:
- Learning steps: 10 minutes, 1 day
- Ease starts at 2.5 (bounded 1.3–3.0)
- Daily/new limits are user-configurable per deck

## Running Tests
```bash
npm test
```
Key coverage:
- Scheduling logic: `src/domain/scheduling/__tests__/schedule.test.ts`
- AI prompt/parsing: `src/ai/__tests__/examplePairs.test.ts`

## Notes for Contributors
- Expo/TypeScript project; prefer `npm run start` for development.
- Local DB resets on schema version bump (PRAGMA user_version) during development to keep state consistent.
- Follow existing theming and spacing tokens for UI changes.

## License
Deckly is released under the MIT License (see `LICENSE`).
