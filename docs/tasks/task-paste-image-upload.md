# Paste Image Upload

## Original Goal

Allow image upload to support pasted clipboard images. Prefer the easiest stable option from the user's two proposed flows, and combine both if feasible:

- Toolbar image button opens a dialog where users can choose a local image or paste an image from the clipboard.
- Pasting an image directly in the editor uploads it and inserts the uploaded image at the current cursor position, with an immediate local preview while upload is running.

## Background

The editor already supports configurable image upload through `uploadUrl` or `uploadImage`, extension filtering, toolbar file input upload, and editor paste/drop handlers. Existing paste support only checks `clipboardData.files`, which misses common screenshot paste paths exposed through `clipboardData.items`.

Local clipboard previews must not weaken saved HTML safety. The existing image command only accepts sanitized image URLs, so temporary pasted image previews should stay out of the document model and be removed after upload success or failure.

## Scope

- Detect pasted image files from clipboard item lists as well as file lists.
- Add a toolbar image upload dialog that supports file picking and paste.
- Show a temporary editor-body image preview while image upload is pending.
- Keep existing upload URL/custom uploader APIs and extension restrictions.
- Add focused jsdom tests and run normal verification.

## Out of Scope

- Media library features.
- Broad paste cleanup or Office/Word paste handling.
- New public editor API surface.
- Persisting local `data:` or `blob:` image URLs in saved HTML.

## Task Breakdown

| No. | Task | Dependencies | Verification | Status |
| --- | --- | --- | --- | --- |
| 1 | Inspect current upload, paste, toolbar, and dialog paths | None | Source review | Complete |
| 2 | Add clipboard item image detection and upload dialog wiring | 1 | Unit tests | Complete |
| 3 | Add transient editor preview during pending upload | 2 | Unit tests and build | Complete |
| 4 | Verify and update docs if lasting behavior changes | 2, 3 | `npm test`, `npm run build`, docs review | Complete |

## Execution Order

Start by extending the existing image file helper so both editor paste and dialog paste can reuse one path. Then add the dialog in toolbar/dialog code, followed by upload orchestration and temporary preview handling in `src/editor.ts`. Tests come with the behavior change, then build verification and documentation review.

## Current Progress

Completed. The image toolbar button now opens a lightweight modal dialog with file selection and paste support. Direct editor paste handles clipboard item images before ProseMirror's default clipboard parsing. Pending image uploads render a temporary local preview through a ProseMirror decoration, then remove it after upload success or failure. Saved HTML still only receives sanitized uploaded image URLs.

## Verification Log

| Date | Command or Check | Result | Notes |
| --- | --- | --- | --- |
| 2026-07-04 | `npm test` | Passed | 4 test files, 81 tests. Covers direct clipboard item image paste with preview and toolbar image dialog paste upload. |
| 2026-07-04 | `npm run types` | Passed | TypeScript declaration build completed. |
| 2026-07-04 | `npm run build` | Passed | Declarations, bundles, CSS copy, and size budget checks passed. |
| 2026-07-04 | Browser demo smoke check | Passed | Served `demo/` with `npm run demo:upload`; verified demo loads and the Upload image button opens the Image upload modal with the paste target focused. |

## Issues and Resolutions

| Issue | Resolution |
| --- | --- |
| ProseMirror's normal `handlePaste` path can attempt to read text from clipboard data before custom image upload handling. | Image paste interception now runs in `handleDOMEvents.paste`, returning `true` only for image clipboard files and leaving normal text/HTML paste behavior untouched. |

## Follow-ups

Consider a browser demo smoke pass before release packaging if this interaction is being shipped immediately.

## Notes

Do not allow local preview URLs through HTML serialization. Keep preview state editor-internal and transient.
