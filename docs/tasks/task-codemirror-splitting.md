# CodeMirror Splitting

## Original Goal

Split or lazy-load CodeMirror-related code in Moonglade.Editor, then validate the editor in a real browser so existing functionality is not broken.

## Background

Moonglade.Editor exposes a unified editor package for rich HTML mode and code-like Markdown, raw HTML, and CSS modes. CodeMirror is used by public code-like modes and by the rich HTML source dialog. The main Moonglade app consumes prebuilt static assets from the NuGet package, so improvements must preserve static asset delivery and avoid adding a frontend build step to Moonglade.

## Scope

- Add smaller ESM entry points for rich HTML and code-like consumers.
- Lazy-load the rich HTML source dialog CodeMirror implementation on first use.
- Update build and NuGet staging scripts so split chunks are emitted and packaged.
- Update documentation and tests for the new loading behavior.
- Run unit tests, build, packaging, and browser smoke tests.

## Out of Scope

- Replacing ProseMirror, CodeMirror, or Prettier.
- Changing the synchronous `createMoongladeEditor(...)` compatibility API.
- Changing stored content formats or sanitizer behavior.
- Updating the main Moonglade repository integration in this task.

## Task Breakdown

| No. | Task | Dependencies | Verification | Status |
| --- | --- | --- | --- | --- |
| 1 | Add task record and inspect current source dialog/build flow | None | File review | Done |
| 2 | Lazy-load rich HTML source dialog CodeMirror | 1 | Vitest source dialog coverage | Done |
| 3 | Add split ESM entries and build/package support | 2 | `npm run build`; asset inspection | Done |
| 4 | Update docs/tests for split entries | 2, 3 | `npm test` | Done |
| 5 | Browser smoke test demo | 2, 3, 4 | Browser checks | Done |

## Execution Order

Start with the rich HTML source dialog because it removes unnecessary CodeMirror work from rich HTML startup without changing the public factory API. Then add optional split ESM entries and make the build/pack scripts stage generated chunks. Finally run automated and browser verification.

## Current Progress

Implemented. The rich HTML source dialog now lazy-loads `source-code-editor` on first use. ESM builds now emit the compatibility entry plus `moonglade-editor.rich-html.js`, `moonglade-editor.code.js`, and shared `dist/chunks/` files. NuGet staging recursively copies browser assets so chunks are packaged. README and AGENTS document the new entry/chunk behavior.

## Verification Log

| Date | Command or Check | Result | Notes |
| --- | --- | --- | --- |
| 2026-08-07 | `npm test` | Passed | Baseline: 117 tests passed before edits. |
| 2026-08-07 | `npm run build` | Passed | Baseline build and size budgets passed before edits. |
| 2026-08-07 | `npm test` | Passed | 117 tests passed after lazy source dialog and split ESM changes. |
| 2026-08-07 | `npm run build` | Passed | ESM entries/chunks built and size budgets passed. |
| 2026-08-07 | `npm run pack:nuget` | Passed | Static asset package created; recursive chunk staging verified. |
| 2026-08-07 | Browser demo smoke | Passed | `http://localhost:5173/demo/` loaded; rich source dialog, Markdown edit, CSS format, and mobile rich view checked with no console warnings/errors. |
| 2026-08-07 | Browser split entry smoke | Passed | Temporary ignored smoke page verified `moonglade-editor.rich-html.js` and `moonglade-editor.code.js`; source editor chunk loaded only after source dialog opened. |

## Issues and Resolutions

- Browser `evaluate` does not allow module loading, so split ESM entry verification used a temporary ignored HTML page under `output/`. The page was removed after verification.

## Follow-ups

- Switch the main Moonglade app to the new smaller ESM entries after this package is released.
- Consider language-specific formatter chunks in a separate task.

## Notes

Keep `dist/` generated. Do not hand-edit release output.
