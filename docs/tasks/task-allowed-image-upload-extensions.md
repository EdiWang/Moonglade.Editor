# Allowed Image Upload Extensions

## Original Goal

Add a configuration option for allowed image upload formats. By default, uploads should only allow `.jpg`, `.png`, `.webp`, and `.svg`.

## Background

Image uploads are configured through `createMoongladeEditor(...)` with either `uploadUrl` or `uploadImage`. The toolbar currently uses a hidden file input with `accept="image/*"`, while paste and drop upload the first image file detected by MIME type.

This change affects the public editor options surface, so the configuration and documentation need to stay small and explicit.

## Scope

List what this task will change.

- Add a public option for allowed image upload extensions.
- Default the option to `.jpg`, `.png`, `.webp`, and `.svg`.
- Apply the allowed-extension filter to toolbar file selection, paste, and drag/drop upload flows.
- Update tests and user-facing documentation.

## Out of Scope

- Server-side upload validation.
- New image management/media-library features.
- Changing safe image URL handling or HTML schema behavior.

## Task Breakdown

| No. | Task | Dependencies | Verification | Status |
| --- | --- | --- | --- | --- |
| 1 | Add allowed-extension helpers and editor option | None | Typecheck/tests | Complete |
| 2 | Wire toolbar, paste, and drop upload flows | 1 | Upload tests | Complete |
| 3 | Add tests for defaults, rejection, and overrides | 2 | `npm test` | Complete |
| 4 | Update README/AGENTS/CODEX handoff docs | 1 | Markdown review | Complete |
| 5 | Run verification | 1-4 | `npm test`, `npm run build` | Complete |

## Execution Order

Implement the helper and option first so all upload entry points can use one normalized list. Then update tests and docs after the API shape is settled.

## Current Progress

Implementation complete. `allowedImageExtensions` is now part of `MoongladeEditorOptions`, defaults to `.jpg`, `.png`, `.webp`, and `.svg`, updates the toolbar file input `accept` value, and blocks unsupported files before invoking `uploadImage` or `uploadUrl` upload handling.

## Verification Log

| Date | Command or Check | Result | Notes |
| --- | --- | --- | --- |
| 2026-07-02 | `npm test` | Passed | 66 Vitest/jsdom tests passed, including default rejection and custom extension override coverage. |
| 2026-07-02 | `npm run build` | Passed | Type declarations, bundles, and bundle size checks completed successfully. |

## Issues and Resolutions

One new test initially inserted the custom-format upload at the start of the paragraph because it did not set the editor selection. The test was corrected to place the selection after `Hello`, and the full suite then passed.

## Follow-ups

None planned.

## Notes

The client-side filter improves editor UX but does not replace server-side upload validation.
