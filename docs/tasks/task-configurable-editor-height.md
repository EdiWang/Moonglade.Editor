# Configurable Editor Height

## Original Goal

Add an editor height option that is not hard-coded, supports plain CSS height values such as `px`, `vh`, and `calc(...)`, and defaults to `500px`.

## Background

The editor is initialized through `createMoongladeEditor(...)` in `src/editor.ts`. The host provides a container element, and the editor turns it into a Bootstrap-compatible card with a toolbar and ProseMirror body.

## Scope

- Add a `height?: string` initialization option.
- Apply a default editor height of `500px`.
- Preserve arbitrary CSS height strings without unit conversion.
- Keep long editor content usable inside the fixed-height shell.
- Add tests for default and custom height values.
- Update public API documentation and generated `dist/` assets.

## Out of Scope

- No toolbar control for height.
- No persisted per-user height preference.
- No dependency changes.

## Task Breakdown

| No. | Task | Dependencies | Verification | Status |
| --- | --- | --- | --- | --- |
| 1 | Add height option and default | None | Unit tests | Complete |
| 2 | Update editor body scrolling for fixed height | Task 1 | CSS review and demo smoke check | Complete |
| 3 | Update docs and generated assets | Tasks 1-2 | `npm test`, `npm run build` | Complete |

## Execution Order

Implement the source API first, then adjust layout behavior for fixed-height usage, then update docs and rebuild generated assets.

## Current Progress

Added `height?: string` with default `500px`, custom CSS string support, fixed-height scrolling styles, README/AGENTS/demo updates, and unit tests. Tests and build passed.

## Verification Log

| Date | Command or Check | Result | Notes |
| --- | --- | --- | --- |
| 2026-07-01 | `npm test` | Passed | 4 files, 50 tests. |
| 2026-07-01 | `npm run build` | Passed | Types, bundles, CSS copy, and size checks passed. `dist/` is ignored by this repository. |

## Issues and Resolutions

None yet.

## Follow-ups

None currently expected.

## Notes

The height is applied to the editor container so the toolbar and body fit within a single host-controlled editor shell. The body scrolls when content exceeds the configured height.
