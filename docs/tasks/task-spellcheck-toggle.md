# Spellcheck Toggle

## Original Goal

Add a spellcheck switch to editor initialization, enabled by default. When disabled, content inside the editor should not use browser spellcheck. Add a demo-page button to toggle this behavior outside the editor toolbar.

## Background

The editor is initialized through `createMoongladeEditor(...)` in `src/editor.ts`. The demo page consumes the global bundle from `dist/` and should expose host-page controls outside the editor UI when demonstrating host-owned behavior.

## Scope

- Add a `spellcheck` initialization option.
- Add a small instance API for toggling spellcheck after initialization.
- Set the ProseMirror editor DOM spellcheck attribute.
- Add tests for default, disabled, and toggled behavior.
- Add an external demo-page toggle button.
- Rebuild generated `dist/` assets.

## Out of Scope

- No toolbar button inside the editor UI.
- No broader word-processor spelling or grammar feature.
- No dependency changes.

## Task Breakdown

| No. | Task | Dependencies | Verification | Status |
| --- | --- | --- | --- | --- |
| 1 | Add editor option and instance methods | None | Unit tests | Complete |
| 2 | Add demo toggle outside editor UI | Task 1 | Demo markup/code review | Complete |
| 3 | Update docs and generated assets | Tasks 1-2 | `npm test`, `npm run build` | Complete |

## Execution Order

Implement the source API first, then wire the demo against that API, then update documentation and rebuild assets.

## Current Progress

Added `spellcheck?: boolean` with default-on behavior, `setSpellcheck(...)`, and `getSpellcheck()`. Added a demo-page toggle button outside the editor UI and updated README/AGENTS API examples. Tests, build, and demo smoke checks passed.

## Verification Log

| Date | Command or Check | Result | Notes |
| --- | --- | --- | --- |
| 2026-07-01 | `npm test` | Passed | 4 files, 48 tests. |
| 2026-07-01 | `npm run build` | Passed | Types, bundles, CSS copy, and size checks passed. |
| 2026-07-01 | Browser demo smoke check | Passed | Served `demo/`, verified page identity, console health, initial `spellcheck="true"`, toggle to `spellcheck="false"`, and button label/state update. |

## Issues and Resolutions

None yet.

## Follow-ups

None currently expected.

## Notes

The toggle belongs to the host/demo page, not the editor toolbar.
