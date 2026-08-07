# Split Formatter Runtime

## Original Goal

Split the lazy Prettier formatter runtime so formatting CSS does not load Markdown and HTML Prettier plugins, and formatting each code-like language only loads the plugin it needs.

## Background

Moonglade.Editor code-like modes support Markdown, raw HTML, and CSS formatting. The current lazy formatter asset imports Prettier standalone plus all three plugins in one file. The public `formatCode(...)` API should stay unchanged, and Moonglade should continue consuming prebuilt static assets without a frontend build step.

## Scope

- Split formatter runtime source files by language.
- Update runtime lookup so `formatCode(...)` lazy-loads the formatter asset for the requested language.
- Update build, size, and NuGet staging scripts for the new formatter assets.
- Update tests and documentation for the split formatter assets.

## Out of Scope

- Replacing Prettier.
- Changing the public editor API.
- Changing editor storage formats, sanitization, or CodeMirror behavior.
- Updating the main Moonglade repository integration in this task.

## Task Breakdown

| No. | Task | Dependencies | Verification | Status |
| --- | --- | --- | --- | --- |
| 1 | Inspect formatter runtime, build, tests, and docs | None | File review | Done |
| 2 | Implement language-specific formatter runtime loading | 1 | Focused tests | Done |
| 3 | Update build/package scripts and docs | 2 | `npm run build` | Done |
| 4 | Run automated and browser verification | 2, 3 | `npm test`, `npm run build`, browser smoke | Done |

## Execution Order

Start with source/runtime changes, then update build and package scripts so generated assets match the runtime lookup. Finally update tests and docs and run verification.

## Current Progress

Implemented. Formatter loading is now language-specific: Markdown, HTML, and CSS use separate lazy runtime entry files, each importing only its own Prettier plugin plus a shared Prettier standalone helper chunk. Build, size, NuGet staging, README, AGENTS, and tests were updated.

## Verification Log

| Date | Command or Check | Result | Notes |
| --- | --- | --- | --- |
| 2026-08-08 | File review | Passed | Formatter currently emits one `moonglade-editor.formatter.js` bundle. |
| 2026-08-08 | `npm test -- --run test/code-editor.test.ts` | Passed | 18 tests passed, including per-language formatter runtime caching coverage. |
| 2026-08-08 | `npm test` | Passed | 119 tests passed. |
| 2026-08-08 | `npm run build` | Passed | Formatter split output: Markdown 284.0KB, HTML 166.1KB, CSS 154.5KB, shared formatter chunk 81.0KB. |
| 2026-08-08 | Node dynamic import of built formatter assets | Passed | CSS, HTML, and Markdown runtime files each imported and formatted sample input. |
| 2026-08-08 | Browser demo smoke | Passed | CSS formatting loaded only `moonglade-editor.formatter.css.js` plus the shared formatter chunk. |
| 2026-08-08 | `npm run pack:nuget` | Passed | Static asset package created with split formatter assets after updating the package project validation. |

## Issues and Resolutions

- First `npm run pack:nuget` failed because `Moonglade.Editor.StaticAssets.csproj` still validated the old single `moonglade-editor.formatter.js` asset. Updated the validation target to require the three language-specific formatter files, then reran packaging successfully.

## Follow-ups

None.

## Notes

Keep `dist/` generated. Do not hand-edit release output.
