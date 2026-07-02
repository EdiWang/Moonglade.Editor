# Table Toolbar Menu

## Original Goal

Redesign the toolbar table controls so table actions live in a menu similar to the provided screenshot instead of appearing as separate flat toolbar buttons.

## Background

The editor toolbar is framework-free TypeScript built with DOM APIs in `src/toolbar.ts`, with styling in `src/styles.css` and toolbar behavior verified in `test/editor.test.ts`. The demo only loads Bootstrap CSS and Bootstrap Icons CSS, so the menu must manage open/close state without Bootstrap JavaScript.

## Scope

- Replace the flat table button group with a single table dropdown entry.
- Add a table insertion grid for choosing table dimensions.
- Keep existing table commands for row, column, header row, and delete table operations.
- Update focused toolbar tests and run the normal verification commands.

## Out of Scope

- New table properties editing.
- Cell merge/split controls.
- Generated `dist/` changes unless needed only for local verification.
- Broad toolbar redesign outside the table area.

## Task Breakdown

| No. | Task | Dependencies | Verification | Status |
| --- | --- | --- | --- | --- |
| 1 | Inspect existing toolbar, command, and test patterns | None | Source review | Done |
| 2 | Add task record | Task 1 | Markdown diff review | Done |
| 3 | Implement table dropdown DOM and styles | Task 1 | Type check and toolbar tests | Done |
| 4 | Update tests for table menu and grid insertion | Task 3 | `npm test` | Done |
| 5 | Build and visually check the demo toolbar | Task 3 | `npm run build`, browser check | Done |

## Execution Order

Implement the menu DOM and command wiring first, then update tests around the new structure. Run unit tests before the full build so behavior regressions are caught quickly.

## Current Progress

Task completed on 2026-07-02. The toolbar now exposes one table dropdown trigger. The dropdown contains a table-size grid plus row, column, header-row, and delete-table commands.

## Verification Log

| Date | Command or Check | Result | Notes |
| --- | --- | --- | --- |
| 2026-07-02 | Source inspection | Passed | Found flat table command group in `src/toolbar.ts`. |
| 2026-07-02 | `npm run types` | Passed | TypeScript declaration build completed. |
| 2026-07-02 | `npm test` | Passed | 4 files, 66 tests passed. |
| 2026-07-02 | `npm run build` | Passed | Bundles and CSS stayed within size budgets. |
| 2026-07-02 | Browser QA, desktop 1280x720 | Passed | Menu opens as a two-column dropdown, 5x3 grid action inserted 3 rows and 15 cells, row command panel added 1 row. |
| 2026-07-02 | Browser QA, mobile 390x720 | Passed | Menu collapses to one column and no longer overflows horizontally. |

## Issues and Resolutions

### Browser cached old built CSS during QA

- Symptom: The new table menu DOM rendered, but computed styles still reflected the prior `dist/moonglade-editor.css`.
- Root cause: The local browser reused the existing CSS resource during repeated demo checks.
- Fix: Used a temporary no-store QA server with cache-busted dist asset URLs for visual verification.
- Verification: The no-cache QA page loaded the new table menu rules and passed desktop and mobile checks.

## Follow-ups

None identified.

## Notes

The menu should keep Bootstrap-compatible classes and follow nearest host theme variables through CSS custom properties.
