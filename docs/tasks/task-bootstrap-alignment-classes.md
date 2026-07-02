# Bootstrap Alignment Classes

## Original Goal

Change text alignment serialization from inline `style="text-align: ..."` output to Bootstrap text alignment classes such as `text-center`.

## Background

Moonglade.Editor stores constrained HTML and relies on Bootstrap-compatible output for host rendering. Alignment previously parsed `style`, `align`, and command state into an internal `align` attribute, then serialized paragraphs, headings, and table cells back to inline `text-align` styles.

## Scope

- Map internal text alignment values to Bootstrap text alignment classes during serialization.
- Continue importing existing `style="text-align: ..."` and `align` attributes for backward compatibility.
- Import Bootstrap alignment classes into the same internal alignment attribute.
- Preserve custom classes without duplicating alignment class tokens.
- Update focused sanitizer, HTML round-trip, command, and toolbar tests.

## Out of Scope

- Adding broad typography controls.
- Changing color style serialization.
- Changing generated `dist/` release artifacts.
- Changing Moonglade integration or release packaging.

## Task Breakdown

| No. | Task | Dependencies | Verification | Status |
| --- | --- | --- | --- | --- |
| 1 | Add Bootstrap alignment class sanitizers and mapping helpers | None | `npm test` | Complete |
| 2 | Update schema parse/serialize paths for paragraphs, headings, and table cells | 1 | HTML round-trip tests | Complete |
| 3 | Update behavior tests from style output to class output | 2 | `npm test` | Complete |
| 4 | Run typecheck, tests, and build | 1-3 | `npm run types`, `npm test`, `npm run build` | Complete |

## Execution Order

Implement the sanitizer helpers first, wire schema serialization through those helpers, then update tests and run the normal verification commands.

## Current Progress

The source, test, and documentation changes are implemented. Verification passed.

## Verification Log

| Date | Command or Check | Result | Notes |
| --- | --- | --- | --- |
| 2026-07-02 | `npm run types` | Passed | Declaration typecheck completed successfully. |
| 2026-07-02 | `npm test` | Passed | 77 Vitest/jsdom tests passed. |
| 2026-07-02 | `npm run build` | Passed | Declarations, bundles, and size checks completed successfully. |

## Issues and Resolutions

No issues yet.

## Follow-ups

None known.

## Notes

The importer still recognizes legacy inline alignment styles and `align` attributes so existing saved HTML can migrate naturally to class output on the next serialization.
