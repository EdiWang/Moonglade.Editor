# Inline Code Insert Button

## Original Goal

Enhance the existing Insert code toolbar button so selected text is wrapped with an inline `<code>` tag. When no text is selected, keep the current code snippet insertion behavior.

## Background

The editor already supports the ProseMirror inline `code` mark through the schema, and the existing Insert code toolbar button opens the code snippet dialog that applies a `code_block`. The change should reuse the existing schema and keep the code snippet dialog for empty selections.

## Scope

- Add an internal command for toggling the inline code mark.
- Route the Insert code button to inline code when the selection is non-empty.
- Preserve the code snippet dialog when the selection is empty.
- Update toolbar active/enabled state for inline code.
- Add focused command and toolbar tests.
- Sync lightweight project documentation for the supported inline code capability.

## Out of Scope

- No new public API.
- No changes to code block language configuration.
- No generated `dist/` edits by hand.
- No broad editor or toolbar refactor.

## Task Breakdown

| No. | Task | Dependencies | Verification | Status |
| --- | --- | --- | --- | --- |
| 1 | Inspect existing code snippet command, dialog, toolbar state, and tests | None | Local source review | Complete |
| 2 | Implement inline code command and toolbar routing | Task 1 | Typecheck and focused tests | Complete |
| 3 | Add tests for command-level and toolbar-level behavior | Task 2 | `npm test` | Complete |
| 4 | Update relevant docs | Task 2 | Markdown diff review | Complete |
| 5 | Run verification | Tasks 2-4 | `npm test`, `npm run build` | Complete |

## Execution Order

Implement the command first, then connect toolbar routing, then cover both behavior layers with tests. Documentation follows the verified behavior so future agents can recover intent without reading every diff.

## Current Progress

Implementation, tests, documentation updates, and verification are complete.

## Verification Log

| Date | Command or Check | Result | Notes |
| --- | --- | --- | --- |
| 2026-07-04 | `npm test` | Passed | 83 Vitest/jsdom tests passed, including inline code command and toolbar coverage. |
| 2026-07-04 | `npm run build` | Passed | Type declarations, esbuild bundles, and bundle size checks passed. |

## Issues and Resolutions

None yet.

## Follow-ups

None currently expected.

## Notes

The desired HTML for selected text is inline `<code>selected text</code>`, not a block `<pre><code>...</code></pre>`.
