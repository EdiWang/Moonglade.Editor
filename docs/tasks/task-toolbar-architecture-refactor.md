# Toolbar Architecture Refactor

## Original Goal

Refactor `src/toolbar.ts` because it has become too long and owns every toolbar tool directly. Split each tool or tool group into focused modules and prepare a flexible internal architecture for adding tools later.

## Background

The editor is a framework-free TypeScript package built directly on ProseMirror. Toolbar DOM is built with native DOM APIs and Bootstrap-compatible classes. Existing tests assert specific toolbar selectors, command IDs, and group order, so this refactor should preserve public API, behavior, and rendered toolbar structure unless a change is explicitly required.

Related files:

- `src/toolbar.ts`
- `src/editor.ts`
- `src/dialogs.ts`
- `src/commands.ts`
- `src/editor-state.ts`
- `test/editor.test.ts`

## Scope

Split toolbar construction into focused tool modules, introduce shared toolbar context/DOM primitives, keep `createToolbar(...)` as the public toolbar assembly entry point, and verify behavior through existing tests and build.

## Out of Scope

Do not add new editor features, change toolbar behavior, change command semantics, edit generated `dist/` files by hand, or alter the public `createMoongladeEditor(...)` API.

## Task Breakdown

| No. | Task | Dependencies | Verification | Status |
| --- | --- | --- | --- | --- |
| 1 | Record task and review current toolbar/editor coupling | None | Source inspection | Complete |
| 2 | Add shared toolbar types/context and DOM helpers | 1 | Typecheck | Complete |
| 3 | Extract tool groups for history, format selector, inline marks, colors, blocks, alignment, insertion, table, source, dialogs, and status | 2 | `npm test` | Complete |
| 4 | Preserve top-level toolbar exports used by `editor.ts` | 3 | `npm test` | Complete |
| 5 | Run full verification | 4 | `npm test`, `npm run build` | Complete |

## Execution Order

Create the shared internal contract first, then move existing behavior into small modules without changing DOM output. Once behavior is preserved, run tests and build, then update this task record with verification results.

## Current Progress

Completed. `src/toolbar.ts` is now a 105-line assembly layer. Shared toolbar contracts and DOM helpers live under `src/toolbar/`, with focused tool modules for history, block format selection, inline marks, colors, blocks/lists, alignment, insertion, tables, source mode, dialogs, upload status, and image file selection.

## Verification Log

| Date | Command or Check | Result | Notes |
| --- | --- | --- | --- |
| 2026-07-02 | Source inspection | Passed | Confirmed `toolbar.ts` currently owns assembly, DOM primitives, color dropdowns, image input, table menu, source button, upload status, and dialog mounting. |
| 2026-07-02 | `npm run types` | Passed | Type declarations compile after introducing toolbar submodules and top-level re-exports. |
| 2026-07-02 | `npm test` | Passed | 4 test files, 73 tests. Existing toolbar DOM order, selectors, dialogs, color controls, image upload, tables, and source mode still pass. |
| 2026-07-02 | `npm run build` | Passed | Clean, declarations, esbuild bundles, CSS copy, and size budgets passed. |

## Issues and Resolutions

No behavior regressions were found during test/build verification.

## Follow-ups

None yet.

## Notes

Keep this as an internal architecture refactor. The host-facing API and generated assets strategy should remain unchanged.
