# Fix Mixed List Toolbar Toggle

## Original Goal

Fix the toolbar list buttons when a selection spans existing bullet and numbered lists. The selection should convert into one unified target list instead of disabling bullet conversion or producing restarted numbering such as `1, 2, 1, 2`.

## Background

`src/commands.ts` handled list toggles from only the selection start's active list. When the selection crossed adjacent `ul` and `ol` nodes, converting to ordered changed only the first list node, leaving two adjacent ordered lists that rendered with restarted numbering.

## Scope

- Update list toggle commands to detect selected mixed list nodes.
- Convert selected mixed lists to the requested list type.
- Join adjacent selected lists after conversion.
- Add focused command tests for mixed bullet/ordered selections.

## Out of Scope

- Broad word-processor list behavior.
- Paste cleanup or arbitrary HTML normalization beyond the existing schema/sanitizer path.
- Generated `dist/` changes.

## Task Breakdown

| No. | Task | Dependencies | Verification | Status |
| --- | --- | --- | --- | --- |
| 1 | Reproduce mixed list conversion in command tests | None | Failing/passing Vitest cases | Complete |
| 2 | Update list toggle command behavior | Task 1 | Command tests | Complete |
| 3 | Run project verification | Task 2 | `npm test`, `npm run build` | Complete |
| 4 | Browser-check demo interaction | Task 3 | Demo selection/list toolbar flow | Complete |

## Execution Order

Start with command-level reproduction because the toolbar delegates directly to `commands.bulletList` and `commands.orderedList`. After the command behavior is fixed, run npm verification, then browser-check the demo flow.

## Current Progress

Implementation, command tests, build verification, and browser demo verification are complete.

## Verification Log

| Date | Command or Check | Result | Notes |
| --- | --- | --- | --- |
| 2026-07-02 | `npm test` | Passed | 4 files, 79 tests. |
| 2026-07-02 | `npm run build` | Passed | Types, bundle, and size checks passed. |
| 2026-07-02 | Browser demo at `http://127.0.0.1:4173/demo/index.html` | Passed | Source-set mixed `ul`/`ol`, selected all four list items, toolbar ordered produced one `ol`; toolbar bullet produced one `ul`; no console warnings/errors. |

## Issues and Resolutions

- Root cause: `toggleList` only converted the active list at the selection start, so adjacent selected lists were not unified.
- Fix: Detect selected list nodes, convert mixed selections to the requested list type, and join adjacent selected list nodes.

## Follow-ups

None currently known.

## Notes

Keep this behavior focused on existing list nodes selected by the user. Do not introduce broad document cleanup or paste normalization as part of this fix.
