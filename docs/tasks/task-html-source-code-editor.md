# HTML Source Code Editor

## Original Goal

Change the HTML source view from a plain textarea into a richer editing experience with syntax highlighting, code folding, and find/replace, using `E:\GitHub\ediwang\Moonglade.CodeEditor` as the implementation reference.

## Background

The current source view is created by `src/dialogs.ts` as a plain `<textarea>` inside `.mg-editor-source-dialog`. `src/editor.ts` opens it by assigning `sourceTextarea.value = this.getHTML()` and applies changes through `setHTML(...)`, so source-mode edits already pass through the existing schema and sanitizer boundary.

The reference `Moonglade.CodeEditor` uses CodeMirror 6:

- `@codemirror/lang-html` for HTML language support.
- `@codemirror/language` folding and syntax highlighting helpers.
- `@codemirror/search` for the built-in search and replace panel.
- `@codemirror/view`, `@codemirror/state`, and `@codemirror/commands` for the editor view and keymaps.
- `@lezer/highlight` for theme token tags.

## Scope

- Add the minimal CodeMirror dependencies needed for the HTML source dialog.
- Replace the source dialog textarea with a CodeMirror-backed control while preserving the existing hidden `[name="source"]` textarea compatibility for tests/forms.
- Add source-dialog toolbar buttons for find and replace.
- Support code folding in the source editor through CodeMirror fold gutter and key bindings.
- Keep saving source HTML routed through `applySourceHtml(...)` and the existing sanitizer-backed `setHTML(...)`.
- Update styles, tests, and documentation affected by the feature.

## Out of Scope

- No standalone public code editor API in this package.
- No Markdown/CSS/general code editor modes.
- No HTML formatter, autocomplete customization, media library, or broader word-processor features.
- No manual edits to generated `dist/` artifacts.

## Task Breakdown

| No. | Task | Dependencies | Verification | Status |
| --- | --- | --- | --- | --- |
| 1 | Add task record and inspect reference implementation | None | Local inspection | Done |
| 2 | Add CodeMirror dependencies | Task 1 | `npm install` / lockfile update | Done |
| 3 | Implement source editor wrapper and dialog wiring | Task 2 | Unit tests for source dialog, search panel, folding surface | Done |
| 4 | Add Bootstrap-compatible styles for CodeMirror source mode | Task 3 | CSS inspection and rendered demo check | Done |
| 5 | Update README/docs if needed | Task 3 | Markdown diff review | Done |
| 6 | Verify tests, build, and browser demo | Tasks 3-5 | `npm test`, `npm run build`, browser check | Done |

## Execution Order

Start with dependencies because TypeScript imports require package metadata. Then add a small internal source-editor module and wire it into the existing dialog contract. Styling and tests follow the DOM shape. Documentation and build verification come last.

## Current Progress

Task started on 2026-07-29. Current source mode and reference CodeMirror implementation have been inspected. CodeMirror dependencies have been added to `package.json` and `package-lock.json`. The source dialog now uses an internal CodeMirror-backed HTML editor with find/replace toolbar actions and a hidden textarea bridge. Implementation, documentation, tests, build, and browser demo validation are complete.

## Verification Log

| Date | Command or Check | Result | Notes |
| --- | --- | --- | --- |
| 2026-07-29 | Local source/reference inspection | Passed | Located current textarea source dialog and reference CodeMirror implementation. |
| 2026-07-29 | `npm install @codemirror/commands@^6.10.4 @codemirror/lang-html@^6.4.11 @codemirror/language@^6.12.4 @codemirror/search@^6.7.1 @codemirror/state@^6.7.1 @codemirror/view@^6.43.7 @lezer/highlight@^1.2.3` | Passed with warnings | Added 19 packages. npm reported one high severity audit item and blocked `esbuild` install script under local policy. |
| 2026-07-29 | `npm run types` | Passed | TypeScript declarations compile with CodeMirror imports. |
| 2026-07-29 | `npm test` | Passed | 94 tests passed after updating source-dialog tests for CodeMirror and jsdom Range measurement. |
| 2026-07-29 | `npm run build` | Failed before budget update | Bundles generated, but size budgets failed at 790.3 KB ESM, 790.8 KB global, and 15.1 KB CSS after adding CodeMirror. |
| 2026-07-29 | `npm run build` | Passed | Updated `scripts/check-size.mjs` budgets to 825 KB ESM, 850 KB global, and 17 KB CSS. Actual output: 790.3 KB ESM, 790.8 KB global, 15.1 KB CSS. |
| 2026-07-29 | Browser demo at `http://127.0.0.1:5174/demo/` | Passed | Verified page identity, nonblank editor, no console warn/error, CodeMirror source dialog, line numbers, fold gutter, highlighted tokens, direct source edit/save, find/replace with async search decoration wait, and fold/unfold placeholder behavior. |
| 2026-07-29 | `npm audit --omit=dev` | Passed | No production dependency vulnerabilities reported. |
| 2026-07-29 | `npm audit` | Failed | One high severity advisory in dev dependency `postcss <=8.5.17`; not introduced as a runtime dependency. |

## Issues and Resolutions

### Bundle size budget increased

- Symptom: `npm run build` generated assets successfully but failed `npm run size`.
- Root cause: CodeMirror HTML language support, search, folding, state, and view runtime materially increased bundled JavaScript and source-mode CSS.
- Fix: Increased `scripts/check-size.mjs` budgets to keep the new source-mode feature covered while retaining explicit limits.
- Verification: `npm run build` passed with actual output below the new limits.

### CodeMirror search decorations update asynchronously in browser automation

- Symptom: Filling the search panel and immediately clicking `replace all` did not replace text during Browser automation.
- Root cause: CodeMirror search match decorations were not available until after a short UI update cycle.
- Fix: Browser validation waited for search state before clicking replace all; no production code change was needed.
- Verification: Replace all changed source text and saving updated both the editor content and attached textarea.

## Follow-ups

None yet.

## Notes

Keep the public API centered on `createMoongladeEditor(...)`; the CodeMirror source editor should remain an internal implementation detail of the HTML source dialog.
