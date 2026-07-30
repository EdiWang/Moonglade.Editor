# Unified Editor Package

## Original Goal

Merge the rich HTML editor and CodeMirror-based code editor into one `Moonglade.Editor` package so host applications can initialize different modes through one public API.

## Background

`Moonglade.Editor` previously owned the ProseMirror rich HTML editing surface. `Moonglade.CodeEditor` owned CodeMirror-based Markdown, raw HTML, and CSS editing. The package-level architecture now keeps both engines internally and exposes `createMoongladeEditor({ mode })` as the primary entry point.

## Scope

- Bring the CodeMirror code editor source and dependencies into this package.
- Add a unified mode-based API for rich HTML, Markdown, raw HTML, and CSS modes.
- Keep compatibility exports for old code editor consumers during migration.
- Build one JavaScript bundle, one CSS bundle, and a formatter runtime asset.
- Add focused tests and update package documentation.

## Out of Scope

- Replacing ProseMirror with CodeMirror for rich HTML editing.
- Replacing CodeMirror with ProseMirror for code-like modes.
- Removing compatibility exports immediately.
- Changing Moonglade application data storage or rendering behavior.

## Task Breakdown

| No. | Task | Dependencies | Verification | Status |
| --- | --- | --- | --- | --- |
| 1 | Copy CodeEditor source into package under code-specific module names | None | TypeScript build | Done |
| 2 | Add unified `createMoongladeEditor({ mode })` API and aliases | Task 1 | Vitest | Done |
| 3 | Update build scripts for combined CSS and formatter runtime output | Task 2 | `npm run build` | Done |
| 4 | Add focused unified API tests | Task 2 | `npm test` | Done |
| 5 | Update README, package metadata, and AGENTS guidance | Tasks 1-4 | Documentation review | Done |

## Execution Order

The package was updated before Moonglade application integration so the main repository could continue consuming checked-in static assets without adding a frontend build pipeline.

## Current Progress

Completed. The package now exposes `createMoongladeEditor({ mode: 'rich-html' })` for ProseMirror rich HTML editing and `createMoongladeEditor({ mode: 'markdown' | 'html' | 'css' })` for CodeMirror-backed code modes.

## Verification Log

| Date | Command or Check | Result | Notes |
| --- | --- | --- | --- |
| 2026-07-30 | `npm run types` | Passed | Unified package type declarations compile. |
| 2026-07-30 | `npm test` | Passed | 5 test files, 97 tests. |
| 2026-07-30 | `npm run build` | Passed | Generated JS, CSS, formatter runtime, and type declarations within updated size budgets. |

## Issues and Resolutions

- `npm install` reported one high-severity audit issue in the dependency graph. It was not auto-fixed during this task because audit remediation may change more dependency versions than the editor merge requires.

## Follow-ups

- Consider removing `createMoongladeCodeEditor` compatibility exports after downstream consumers have migrated.
- Revisit bundle splitting if loading one unified entry becomes too heavy for pages that only use one mode.

## Notes

The package remains the only place where npm, TypeScript, esbuild, ProseMirror, CodeMirror, and Prettier are required. Host applications should consume generated static assets.
