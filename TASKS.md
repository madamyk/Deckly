# Deckly Tasks

This repo is intentionally scaffolded as a small-but-complete MVP. Use this list as a roadmap for follow-up work.

## MVP (implemented)
- [x] Expo SDK 54 + React Native + TypeScript + expo-router stack navigation
- [x] Offline-first persistence with SQLite (`expo-sqlite`) behind repositories
- [x] Deck CRUD: list/create/rename/delete (soft-delete)
- [x] Card CRUD per deck: list/search/add/edit/delete (soft-delete)
- [x] Review flow: due queue per deck + flip to reveal + Again/Hard/Good/Easy ratings
- [x] Scheduling module (Anki-lite / SM-2-ish) as a pure function + Jest tests
- [x] CSV import: file picker + preview + column mapping + import + optional dedupe summary
- [x] Dark mode support + consistent UI primitives
- [x] AI Assist stubs (`src/ai/*`) + Settings screen section (disabled)

## Next (nice to have)
- [ ] Improve CSV parsing UX: "first row is header" auto-detect, delimiter choice, show column-by-column preview
- [ ] Faster import: batch inserts (single SQL statement / prepared statements)
- [ ] Review session options: daily limit, "cram" mode, bury siblings, randomization
- [ ] Better search: optional FTS table for cards (SQLite FTS5)
- [ ] Deck list stats: show due counts on the Home screen
- [ ] Better delete UX: swipe actions for cards, undo (soft-delete restore)
- [ ] Accessibility pass: larger hit targets, dynamic type, screen reader labels

## Future architecture work
- [ ] AI Assist enablement: SecureStore key entry + provider selection + UI actions on Card screen
- [ ] Sync-ready schema: add `serverId`, `dirtyAt`, `version`, conflict strategy
- [ ] Export: CSV export per deck + full backup/restore
- [ ] Theming: per-user theme choice + typography customization

