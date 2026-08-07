# Playwright Demo Smoke Tests

## Original Goal

Split the oversized rich editor jsdom test file by behavior area, then add a small Playwright demo smoke test suite that exercises high-risk UI behavior in a real browser.

## Background

`test/editor.test.ts` has grown past 55KB and covers toolbar wiring, source dialog behavior, textarea sync, and image upload in one file. jsdom coverage is useful but does not fully validate focus, real browser editing, drag/drop, paste, lazy source dialog loading, and toolbar interactions. The demo page already hosts all editor modes and an upload endpoint through `scripts/upload-test-server.mjs`.

## Scope

- Extract shared rich editor test helpers.
- Split rich editor jsdom tests into smaller files by sync, toolbar, source dialog, and upload behavior.
- Add a small Playwright demo smoke test suite for real browser coverage.
- Add npm scripts and documentation for the browser smoke tests.
- Run jsdom tests, build, and the new browser smoke tests.

## Out of Scope

- Changing editor behavior or public APIs.
- Replacing Vitest jsdom coverage.
- Adding broad end-to-end coverage for every toolbar command.
- Updating the main Moonglade repository.

## Task Breakdown

| No. | Task | Dependencies | Verification | Status |
| --- | --- | --- | --- | --- |
| 1 | Inspect current rich editor tests and demo server | None | File review | Done |
| 2 | Split jsdom tests by behavior area | 1 | `npm test` | Done |
| 3 | Add Playwright demo smoke tests and scripts | 1 | `npm run test:demo` | Done |
| 4 | Update docs and run full verification | 2, 3 | `npm test`, `npm run build`, `npm run test:demo` | Done |

## Execution Order

Split the jsdom tests first so the existing coverage remains stable. Then add Playwright tests against the built demo page and wire them to npm scripts. Finish with docs and verification.

## Current Progress

Implemented. The rich editor jsdom tests are split into smaller files for basics, sync/lifecycle, toolbar, source dialog, and image upload. The demo now wires Markdown image upload to the local upload endpoint. A Playwright smoke suite runs against the built demo page and covers focus, toolbar interaction, rich HTML toolbar image upload, HTML source dialog save/focus behavior, and Markdown paste/drop image upload.

## Verification Log

| Date | Command or Check | Result | Notes |
| --- | --- | --- | --- |
| 2026-08-08 | File review | Passed | `test/editor.test.ts` is 56KB and contains toolbar, sync, source dialog, and upload coverage. |
| 2026-08-08 | `npm test` | Passed | 119 jsdom tests passed after splitting `editor.test.ts`. |
| 2026-08-08 | First `npm run test:demo` | Failed | Playwright Chromium browser was not installed locally. |
| 2026-08-08 | `npx playwright install chromium` | Passed | Installed the browser binary required by the new smoke tests. |
| 2026-08-08 | `npm run test:demo` | Passed | 2 Playwright smoke tests passed. |
| 2026-08-08 | `npm run build` | Passed | Type declarations, bundles, and size checks passed. |
| 2026-08-08 | Final `npm run test:demo` | Passed | 2 Playwright smoke tests passed after docs and ignore updates. |
| 2026-08-08 | `npm run test:demo` with rich HTML upload coverage | Passed | 3 Playwright smoke tests passed, including rich HTML toolbar image upload and Markdown paste/drop image upload. |

## Issues and Resolutions

- `npm run test:demo` initially failed because `@playwright/test` was installed but Chromium had not been downloaded. Running `npx playwright install chromium` fixed the local environment and the smoke tests passed.

## Follow-ups

None.

## Notes

Use generated `dist/` assets for browser demo smoke tests. Do not commit Playwright output artifacts.
