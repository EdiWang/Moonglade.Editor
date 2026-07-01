# Horizontal Rule Button

## Original Goal

Add a toolbar button that inserts a horizontal rule (`<hr />`) into the Moonglade editor.

## Background

Moonglade.Editor already uses the ProseMirror basic schema as its base, which includes a `horizontal_rule` block node. The editor needs an explicit command and toolbar button so authors can insert a divider from the UI while still round-tripping content through the existing schema and sanitizer boundary.

## Scope

- Add an editor command for inserting horizontal rules.
- Add a toolbar button for the command.
- Ensure HTML parsing and serialization preserve supported `<hr>` content.
- Add or update Vitest coverage for command behavior and toolbar wiring.
- Update docs that enumerate supported editor capabilities.

## Out of Scope

- Custom divider styling controls.
- Multiple divider variants.
- Broad word-processor features unrelated to Moonglade blog editing.

## Task Breakdown

| No. | Task | Dependencies | Verification | Status |
| --- | --- | --- | --- | --- |
| 1 | Confirm existing schema support for `horizontal_rule` | None | Inspect `src/schema.ts` and ProseMirror base schema usage | Complete |
| 2 | Add insertion command and toolbar button | Task 1 | Command and toolbar tests | Complete |
| 3 | Update parser/serializer tests and docs | Task 2 | `npm test` | Complete |
| 4 | Rebuild generated assets | Tasks 2-3 | `npm run build` | Complete |

## Execution Order

Use the existing base schema node, then expose it through `createCommands(...)`, wire it into the insert toolbar group, and add tests before regenerating `dist/`.

## Current Progress

Horizontal rule insertion is implemented, tested, documented, and rebuilt into `dist/`.

## Verification Log

| Date | Command or Check | Result | Notes |
| --- | --- | --- | --- |
| 2026-07-01 | Source inspection | Passed | `basicSchema` already includes `horizontal_rule`; no custom node spec required. |
| 2026-07-01 | `npm test` | Passed | 46 Vitest/jsdom tests covering HTML round-trip, command insertion, toolbar wiring, and existing editor behavior. |
| 2026-07-01 | `npm run build` | Passed | Regenerated declaration files, ESM/global bundles, CSS copy, maps, and passed size checks. |
| 2026-07-01 | Browser demo smoke check | Passed | Served `demo/` locally, verified page identity, no console warnings/errors, horizontal rule button click, textarea sync, screenshot evidence, and mobile button visibility. |

## Issues and Resolutions

No issues yet.

## Follow-ups

None currently.

## Notes

Keep the feature narrow: one button that inserts the standard `<hr>` element.
