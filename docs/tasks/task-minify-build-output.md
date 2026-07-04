# Minify Build Output

## Original Goal

Reduce the compiled editor asset size because the generated `dist` JavaScript and CSS files were not minified.

## Background

The project uses `scripts/build.mjs` with esbuild to emit ESM and browser-global bundles, while CSS was copied directly from `src/styles.css`. Release assets under `dist/` are ignored in normal development and generated locally for release packaging.

## Scope

- Enable minification for release JavaScript bundles.
- Minify the release CSS output.
- Keep watch-mode output readable for local development.
- Tighten size budgets so unminified output does not pass unnoticed.
- Update build documentation and handoff notes affected by the release asset behavior.

## Out of Scope

- Dependency changes.
- Public API changes.
- Generated `dist/` commits.
- Moonglade application integration changes.

## Task Breakdown

| No. | Task | Dependencies | Verification | Status |
| --- | --- | --- | --- | --- |
| 1 | Inspect current build and size scripts | None | Review `scripts/build.mjs` and `scripts/check-size.mjs` | Complete |
| 2 | Add release minification | Task 1 | `npm run build` | Complete |
| 3 | Update affected docs | Task 2 | Markdown review | Complete |
| 4 | Verify tests and build | Tasks 2-3 | `npm test`, `npm run build` | Complete |

## Execution Order

First confirm the existing build outputs and size budgets, then update build behavior and documentation together. Run the unit tests and full build after the script changes so generated release assets, declarations, bundling, and size checks are verified through the normal command path.

## Current Progress

Build script, size budget, and documentation updates are complete. Verification passed.

## Verification Log

| Date | Command or Check | Result | Notes |
| --- | --- | --- | --- |
| 2026-07-04 | Current `dist` size inspection | Passed | Existing generated JS was about 607kb ESM and 642kb global; CSS was about 11.5kb. |
| 2026-07-04 | `npm test` | Passed | 4 test files and 86 tests passed. |
| 2026-07-04 | `npm run build` | Passed | Minified ESM was 287.8kb, global was 288.3kb, and CSS was 9.6kb; size checks passed. |

## Issues and Resolutions

Release minification reduced JS output by more than half. CSS budget was tightened to 11kb so copied/unminified CSS no longer passes, while leaving room for small intentional style additions.

## Follow-ups

None currently planned.

## Notes

`npm run dev` should stay convenient for debugging and watch rebuilds, so readable non-minified output is preserved only for watch mode.
