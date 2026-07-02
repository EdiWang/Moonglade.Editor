# Codebase Improvement Plan

## Original Goal

Analyze the current `Moonglade.Editor` codebase and record a step-by-step, testable, release-safe improvement plan without changing business code, configuration, tests, dependencies, or generated assets.

## Analysis Date

2026-07-02

## Analysis Scope

- Repository structure and project contract: `AGENTS.md`, `README.md`, `.gitignore`, `package.json`, `tsconfig*.json`, `vitest.config.ts`.
- Core source modules: `src/editor.ts`, `src/commands.ts`, `src/toolbar.ts`, `src/dialogs.ts`, `src/html.ts`, `src/schema.ts`, `src/safety.ts`, `src/image-upload.ts`, `src/editor-state.ts`, `src/editor-options.ts`, `src/index.ts`, `src/styles.css`.
- Tests and coverage shape: `test/editor.test.ts`, `test/commands.test.ts`, `test/html.test.ts`, `test/safety.test.ts`.
- Build and demo support: `scripts/build.mjs`, `scripts/check-size.mjs`, `demo/index.html`.
- Existing task context: `docs/CODEX_HANDOFF.md`, `docs/tasks/*.md`.

No tests, builds, package installs, formatters, audits, or generated-file commands were run during this analysis.

## Summary

Overall risk level: **Medium**.

The codebase is small and generally coherent. The current architecture matches the repository purpose: a focused ProseMirror editor with a narrow public wrapper, DOM-built toolbar/dialogs, schema-backed HTML import/export, and sanitizer helpers. The most valuable next work is not a broad rewrite. It is to tighten a few release-facing behavioral edges, improve task-sized test coverage around them, and clarify the generated `dist/` integration contract before Moonglade consumes the package.

Highest-value priorities:

- Keep `dist/` ignored during normal development and publish generated assets through GitHub Releases.
- Preserve host dirty/autosave support for real edits while avoiding initialization-time false positives.
- Make async image upload selection handling and upload error messages more deterministic.
- Add tests around list/table edge cases before changing command behavior.

Not recommended now:

- Do not replace ProseMirror or introduce a frontend framework.
- Do not add broad word-processor features outside the documented Moonglade blog editor scope.
- Do not upgrade dependencies without a specific security, compatibility, or integration reason.
- Do not perform large file-splitting refactors before behavioral gaps are covered by focused tests.

## Issues

| ID | Priority | Type | Location | Issue | Impact | Evidence | Recommended Direction |
| --- | --- | --- | --- | --- | --- | --- | --- |
| I-01 | P1 | Integration / release | `.gitignore`, `package.json`, `README.md`, `AGENTS.md`, `dist/` | The generated `dist/` assets should not be reviewed on every source change. They should be produced for release and attached to GitHub Releases, then manually copied into Moonglade when needed. | Normal code reviews stay focused on source changes while release artifacts remain available for Moonglade integration. | User initially confirmed `dist` should not be ignored, then corrected the decision on 2026-07-02: keep `/dist` ignored because tracked generated files make reviews too large; publish `dist` files only in GitHub Releases and manually copy them into Moonglade. | Keep `dist/` in `.gitignore`, remove tracked `dist` files from Git, and document release-copy expectations. |
| I-02 | P2 | Stability / host integration | `src/editor.ts` constructor, `syncToTextarea()` | Editor initialization called `syncToTextarea()`, which dispatched a bubbling `input` event and invoked `onChange` before a user edit. | Host pages could mark a post as dirty, trigger autosave, or run change handlers during initialization. This is especially relevant when integrating into the main Moonglade edit page. | Initial code called `this.syncToTextarea()` from the constructor; `syncToTextarea()` set textarea value, dispatched `new Event('input', { bubbles: true })`, and called `this.onChange?.(html)`. User confirmed on 2026-07-02 that host dirty/autosave capability must be preserved. Execution on 2026-07-02 added tests for silent initialization and edit/setHTML/explicit sync notifications. | Resolved by silently writing initial textarea value while preserving host notifications for real edits, `setHTML`, and explicit `syncToTextarea()`. |
| I-03 | P2 | Stability / async state | `src/editor.ts` `savedSelection`, `uploadAndInsertImage()` | Async image upload used a shared `savedSelection` field that is also used by link, color, code, paste, and drop flows. A later interaction could overwrite or clear the selection before the upload resolved. | Uploaded images could be inserted at the wrong selection or fail to restore the intended cursor in multi-upload or user-interaction races. | Initial code assigned `savedSelection` before image button/paste/drop upload and upload completion restored that shared field. Link/code/color flows also read/write the same field. Execution on 2026-07-02 added per-upload selection bookmarks and a delayed uploader test that opens the link dialog before upload completion. | Resolved by capturing an upload-specific bookmark at upload start and passing it through the async upload path. |
| I-04 | P2 | Error handling / UX | `src/image-upload.ts`, `src/editor.ts` upload status | Upload response parsing assumed valid JSON and did not validate response shape before returning the upload result. | Non-JSON responses, empty responses, or missing `location` values could show confusing technical text or flow into later image insertion validation. | Initial `uploadImageToUrl()` called `await response.json()` after `response.ok` and returned an empty `src` when `location` was missing. Execution on 2026-07-02 added normalized errors for HTTP failure, invalid JSON, and missing image URL while preserving unsafe URL rejection. | Resolved by validating URL upload responses in `src/image-upload.ts` and adding upload error edge-case tests. |
| I-05 | P2 | Command behavior / test gap | `src/commands.ts` `toggleList()` | List toggling is simple and may not handle switching between bullet and ordered lists as users expect. | Users may get nested lists or no intuitive conversion when switching list type. | `toggleList(schema, listType)` only lifts when the current selection already has the same list type as an ancestor; otherwise it calls `wrapInList(listType)`. Tests do not cover switching between bullet and ordered lists or nested list behavior. User confirmed on 2026-07-02 that switching should convert the current list type. | Add characterization tests for bullet-to-ordered and ordered-to-bullet behavior, then implement the smallest conversion fix. |
| I-06 | P2 | Command behavior / edge case | `src/commands.ts` `insertTable()` | After table insertion, fallback selection recovery scans the document and picks the first table if `findTable(...)` cannot locate the inserted one. | In documents with existing tables, inserting another table could move the cursor into the wrong table. | `insertTable()` calls `findTable(transaction.selection.$from)?.pos`; if unavailable it runs `transaction.doc.descendants(...)` and assigns the first `schema.nodes.table` position. Existing tests only insert one table. | Add a test for inserting a second table after an existing table. Track the inserted position directly instead of global first-table fallback if the test confirms the issue. |
| I-07 | P2 | Public API / architecture | `src/editor.ts`, `src/index.ts`, `src/commands.ts` | `MoongladeEditorOptions` exposes `schema?: Schema`, but the rest of the package assumes the full Moonglade schema shape. | Passing a custom schema can crash or create missing toolbar commands, widening the public API beyond the documented stable surface. | `MoongladeEditorOptions` includes `schema?: Schema`; constructor passes it to `createCommands`; commands immediately reference nodes/marks such as `paragraph`, `heading`, `bullet_list`, `ordered_list`, `table`, `image`, `text_color`; README public API does not document custom schema usage. User confirmed on 2026-07-02 that custom schema should not be a supported public API. | Remove or hide the custom schema option from the public API before wider release, keeping the built-in `moongladeSchema` as the supported schema. |
| I-08 | P3 | Accessibility / dialog UX | `src/dialogs.ts`, `src/editor.ts` | Dialogs declare modal semantics but do not implement keyboard dismissal, focus trapping, or focus return consistency for all paths. | Keyboard and screen reader users may have a rougher dialog experience, especially in source mode. This is not a core data-safety issue but matters before wider release. | Link/code/source roots set `role="dialog"` and `aria-modal="true"`; close behavior is wired only through explicit buttons/forms; keyword search found no Escape handler or focus trap tests. | Add a small dialog interaction task: Escape close, predictable focus return, and tests. Avoid a full modal framework unless Bootstrap integration later requires it. |
| I-09 | P3 | Maintainability | `src/editor.ts`, `src/toolbar.ts`, `test/editor.test.ts` | The largest files concentrate many responsibilities: editor lifecycle/state/UI wiring, toolbar construction, and broad editor interaction tests. | Future changes may become harder to review and test, but the current size is still manageable. Refactoring now would be lower priority than behavior hardening. | Line counts: `src/toolbar.ts` 363 lines, `src/editor.ts` 360 lines, `test/editor.test.ts` 423 lines. `editor.ts` owns setup, transactions, dialogs, upload, toolbar state; `toolbar.ts` builds all button groups and color controls. | After behavioral fixes, extract only clear seams such as upload selection handling, toolbar state mapping, or dialog helpers. Keep changes small and covered by tests. |

## Task Breakdown

| No. | Task | Dependencies | Verification | Status |
| --- | --- | --- | --- | --- |
| 1 | Ignore `dist` and publish generated assets only for release | User corrected decision: `dist` should stay ignored | `.gitignore` review; `git rm --cached -r dist`; `npm run build`; git status keeps generated files out of normal source diff | Completed |
| 2 | Preserve dirty/autosave for edits while avoiding initialization false positives | User confirmed dirty/autosave capability must remain | Unit tests for constructor, textarea input event, `onChange`, `setHTML`, and document edits | Completed |
| 3 | Harden async image upload selection handling | None after Task 2 decision | Unit tests with delayed uploader and intervening selection/dialog change; `npm test`; `npm run build` | Completed |
| 4 | Normalize image upload response errors | None | Unit tests for invalid JSON, missing location, unsafe URL, HTTP failure; `npm test`; `npm run build` | Completed |
| 5 | Characterize and fix list type switching as conversion | Characterization tests first | Unit tests for bullet-to-ordered, ordered-to-bullet, nested list behavior; `npm test`; `npm run build` | Not started |
| 6 | Fix table insertion cursor recovery for multiple tables | Characterization test first | Unit test for inserting after an existing table; `npm test`; `npm run build` | Not started |
| 7 | Remove unsupported custom schema API surface | User confirmed custom schema should not be supported publicly | Type/API review; `npm run types`; `npm run build` | Not started |
| 8 | Improve dialog keyboard/focus behavior | None | jsdom tests for Escape/cancel/save focus behavior; browser demo smoke check | Not started |
| 9 | Small maintainability extraction after behavior is covered | Tasks 2-8 as relevant | Existing tests unchanged plus focused tests for extracted units; `npm test`; `npm run build` | Not started |

## Detailed Improvement Plan

### Task 1: Ignore `dist` and publish generated assets only for release

- **Priority**: P1
- **Related issues**: I-01
- **Goal**: Keep normal source reviews small while still producing browser-ready editor assets for releases.
- **Change scope**: `.gitignore`, Git tracking state for `dist/`, release documentation if needed.
- **Out of scope**: Business behavior, editor UI, dependency upgrades.
- **Expected result**: `dist/` is ignored during development, not tracked by Git, and generated files are attached to GitHub Releases when publishing.
- **Verification**: Run `npm run build`; verify generated local `dist/` files are ignored and normal source diffs do not include bundle churn.
- **Release risk**: Low for code review; Medium for release process until release artifact steps are documented/automated.
- **Rollback plan**: Re-track `dist/` files and remove the ignore rule if the project later decides to commit generated assets.
- **Needs user confirmation**: No; user corrected the decision on 2026-07-02.
- **Questions to confirm**: None.
- **Execution result**: Completed on 2026-07-02. Restored `dist/` in `.gitignore` and ran `git rm --cached -r dist` so local build output remains present but is no longer tracked.

### Task 2: Preserve dirty/autosave for edits while avoiding initialization false positives

- **Priority**: P2
- **Related issues**: I-02
- **Goal**: Ensure host dirty/autosave logic remains reliable for real edits without being triggered merely by editor construction.
- **Change scope**: `src/editor.ts` sync behavior and related tests.
- **Out of scope**: Changing save payload shape or Moonglade integration code.
- **Expected result**: Initial construction can populate the textarea without false dirty/autosave events; user edits, programmatic content changes that should notify, and explicit sync remain observable by the host.
- **Verification**: Add unit tests for textarea value, `input` event count, `onChange` count, constructor, `setHTML`, and user edit transactions. Run `npm test` and `npm run build` after approval.
- **Release risk**: Medium because hosts may rely on current event behavior.
- **Rollback plan**: Restore current `syncToTextarea()` behavior.
- **Needs user confirmation**: No; user confirmed on 2026-07-02 to preserve dirty/autosave capability and let the implementation choose the safest behavior.
- **Questions to confirm**: None.
- **Execution result**: Completed on 2026-07-02. `src/editor.ts` now writes the initial textarea value without host notification and keeps `syncToTextarea()` as the notifying public method. `test/editor.test.ts` covers silent initialization plus edit, `setHTML`, and explicit sync notifications.

### Task 3: Harden async image upload selection handling

- **Priority**: P2
- **Related issues**: I-03
- **Goal**: Ensure an image upload inserts at the selection captured when that upload started.
- **Change scope**: `src/editor.ts` upload selection handling and tests.
- **Out of scope**: Upload API contract, server endpoint behavior, media library.
- **Expected result**: Delayed uploads and overlapping interactions do not reuse a stale shared selection.
- **Verification**: Add a delayed uploader test that changes selection before resolution; optionally test two concurrent uploads. Run `npm test` and `npm run build`.
- **Release risk**: Low to Medium.
- **Rollback plan**: Revert to the shared `savedSelection` flow.
- **Needs user confirmation**: No.
- **Questions to confirm**: None.
- **Execution result**: Completed on 2026-07-02. `src/editor.ts` now passes a per-upload `SelectionBookmark` into `uploadAndInsertImage(...)`; image button, paste, and drop upload flows no longer depend on the shared dialog `savedSelection` after upload starts. `test/editor.test.ts` covers delayed upload completion after an intervening link dialog selection change.

### Task 4: Normalize image upload response errors

- **Priority**: P2
- **Related issues**: I-04
- **Goal**: Make upload errors predictable and user-readable for invalid JSON, empty JSON, missing location, HTTP failure, and unsafe URL responses.
- **Change scope**: `src/image-upload.ts`, possibly `src/editor.ts` status message mapping, and tests.
- **Out of scope**: File size validation, image transformations, retry queue, server changes.
- **Expected result**: Users see stable upload messages; tests lock down response edge cases.
- **Verification**: Unit tests for invalid JSON, missing `location`, unsafe `location`, and non-OK HTTP. Run `npm test` and `npm run build`.
- **Release risk**: Low.
- **Rollback plan**: Revert error normalization changes.
- **Needs user confirmation**: No.
- **Questions to confirm**: None.
- **Execution result**: Completed on 2026-07-02. `src/image-upload.ts` now catches invalid JSON, validates that URL upload responses include a non-empty `location`, and keeps HTTP failure messages stable. `test/editor.test.ts` covers HTTP failure, invalid JSON, missing image URL, and unsafe image URL.

### Task 5: Characterize and fix list type switching as conversion

- **Priority**: P2
- **Related issues**: I-05
- **Goal**: Convert the current list type when switching between bullet and ordered lists, without overengineering list commands.
- **Change scope**: `src/commands.ts` and `test/commands.test.ts`.
- **Out of scope**: Advanced word-processor list features, custom list styles, indentation UI.
- **Expected result**: Switching between bullet and ordered lists converts the current list type instead of creating surprising nesting.
- **Verification**: Start with characterization tests. Implement the smallest command change and run `npm test` and `npm run build`.
- **Release risk**: Medium because list commands affect existing content editing.
- **Rollback plan**: Revert command change while keeping characterization notes if useful.
- **Needs user confirmation**: No; user confirmed conversion behavior on 2026-07-02.
- **Questions to confirm**: None.

### Task 6: Fix table insertion cursor recovery for multiple tables

- **Priority**: P2
- **Related issues**: I-06
- **Goal**: Keep selection inside the newly inserted table, not an earlier table.
- **Change scope**: `src/commands.ts` table insertion and `test/commands.test.ts`.
- **Out of scope**: Full table UI redesign, row/column picker, table cell styling.
- **Expected result**: Inserting a second table places the cursor in the second table.
- **Verification**: Add a test with an existing table before the insertion point. Run `npm test` and `npm run build`.
- **Release risk**: Low.
- **Rollback plan**: Revert table selection logic.
- **Needs user confirmation**: No.
- **Questions to confirm**: None.

### Task 7: Remove unsupported custom schema API surface

- **Priority**: P2
- **Related issues**: I-07
- **Goal**: Keep the public API narrow and stable by removing or hiding `schema?: Schema` as an unsupported extension point.
- **Change scope**: `src/editor.ts` public options type, README/API docs if needed, and type declarations generated by build.
- **Out of scope**: Designing a plugin architecture or arbitrary schema extension system.
- **Expected result**: Consumers use the built-in Moonglade schema through the supported editor API; accidental custom schema usage is no longer encouraged by the type surface.
- **Verification**: `npm run types`; `npm run build`.
- **Release risk**: Low to Medium because the package is still pre-1.0/private, but the exported type changes.
- **Rollback plan**: Restore the option and current behavior.
- **Needs user confirmation**: No; user confirmed on 2026-07-02 that custom schema should not be supported publicly.
- **Questions to confirm**: None.

### Task 8: Improve dialog keyboard and focus behavior

- **Priority**: P3
- **Related issues**: I-08
- **Goal**: Improve accessibility for link, code, and source dialogs with minimal code.
- **Change scope**: `src/dialogs.ts`, `src/editor.ts`, tests, possibly CSS if focus styling needs adjustment.
- **Out of scope**: Introducing a modal framework or broad UI redesign.
- **Expected result**: Escape closes dialogs, cancel/save paths return focus predictably, and behavior is covered by tests.
- **Verification**: jsdom tests for Escape and focus return; manual demo smoke check in browser before release.
- **Release risk**: Low.
- **Rollback plan**: Revert dialog event handling.
- **Needs user confirmation**: No.
- **Questions to confirm**: None.

### Task 9: Small maintainability extraction after behavior is covered

- **Priority**: P3
- **Related issues**: I-09
- **Goal**: Reduce future change risk in `editor.ts`, `toolbar.ts`, and broad editor tests without changing behavior.
- **Change scope**: Only small extractions with clear boundaries, such as upload selection helpers or toolbar state mapping.
- **Out of scope**: Framework migration, large folder restructuring, dependency changes.
- **Expected result**: Smaller units, same public API, no behavior changes.
- **Verification**: Existing tests plus any focused tests for extracted helpers; `npm test`; `npm run build`.
- **Release risk**: Medium if too broad, Low if kept mechanical and small.
- **Rollback plan**: Revert the extraction commit.
- **Needs user confirmation**: No for tiny internal extractions, Yes for any public API or folder structure change.
- **Questions to confirm**: None yet.

## Recommended Execution Order

1. Task 6: Fix table insertion cursor recovery after adding a characterization test.
2. Task 5: Characterize and adjust list type switching to convert the current list type.
3. Task 7: Remove unsupported custom schema API surface before 1.0 or broader consumption.
4. Task 8: Improve dialog keyboard/focus behavior.
5. Task 9: Do small maintainability extractions only after the above behavioral tests exist.

Completed:

1. Task 1: Ignore `dist` and publish generated assets only for release.
2. Task 2: Preserve dirty/autosave for edits while avoiding initialization false positives.
3. Task 3: Harden async image upload selection handling.
4. Task 4: Normalize image upload response errors.

## Deferred / Not Recommended Now

- Broad editor framework migration: current no-framework DOM approach matches the repository contract and avoids adding a frontend stack to Moonglade.
- Word/Office paste cleanup, emoji insertion, special symbols, line-height, paragraph spacing, collaboration, or media library: explicitly outside the current editor scope unless newly requested.
- Large refactor of `editor.ts` and `toolbar.ts` before behavior hardening: current files are readable enough; extraction first would add churn without reducing the most important risks.
- Dependency upgrades: no clear evidence from this read-only pass that an upgrade is required. Any security/license upgrade should be handled as a separate confirmed task.
- Committing `dist/` in normal feature branches: user corrected the decision; publish generated assets through GitHub Releases instead.

## Open Questions

No open questions remain from this review plan.

## Confirmed Decisions

- 2026-07-02: Corrected decision: `dist/` should be ignored during normal development, generated for release, attached to GitHub Releases, and manually copied into Moonglade when needed.
- 2026-07-02: Host dirty/autosave capability must be preserved. Implementation should avoid false initialization dirty signals while keeping real edit notifications.
- 2026-07-02: Switching between bullet and ordered lists should convert the current list type.
- 2026-07-02: Custom ProseMirror schema injection should not be supported as part of the public API; use the built-in Moonglade schema.

## Execution Log

| Date | Task | Command or Check | Result | Notes |
| --- | --- | --- | --- | --- |
| 2026-07-02 | Task 1 | `git rm --cached -r dist` | Passed | `dist` files remain local but are removed from Git tracking. |
| 2026-07-02 | Task 1, Task 2 | `npm test` | Passed | 4 test files, 54 tests. |
| 2026-07-02 | Task 1, Task 2 | `npm run build` | Passed | Regenerated tracked `dist` artifacts; JS/CSS size checks passed. |
| 2026-07-02 | Task 3 | `npm test` | Passed | 4 test files, 55 tests. |
| 2026-07-02 | Task 3 | `npm run build` | Passed | Regenerated `dist` artifacts; JS/CSS size checks passed. |
| 2026-07-02 | Task 4 | `npm test` | Passed | 4 test files, 58 tests. |
| 2026-07-02 | Task 4 | `npm run build` | Passed | Regenerated ignored local `dist` artifacts; JS/CSS size checks passed. |

## Notes for Future Execution

- Read `AGENTS.md` before making changes.
- Do not edit `dist/` by hand; update source/build scripts and rebuild only for verification or release packaging.
- For behavior changes, add or update tests first or in the same task, then run `npm test` and `npm run build` after user approval.
- Keep changes focused and independently committable.
- Preserve sanitizer and schema constraints; do not weaken safe URL, style, alignment, image, or source-mode handling.
- Avoid unrelated formatting churn.
- If a task changes project commands, dependencies, architecture, public API, or integration flow, update README/AGENTS/docs as part of that task.
