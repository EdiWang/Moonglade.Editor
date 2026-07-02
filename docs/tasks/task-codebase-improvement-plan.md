# Codebase Improvement Plan

## Purpose

This document is the new baseline for follow-up work after the first codebase hardening pass on 2026-07-02. Completed tasks have been removed from the active plan so the remaining work is easier to review, execute, test, and release.

## Analysis Date

2026-07-02

## Analysis Scope

- Repository contract and release context: `AGENTS.md`, `README.md`, `.gitignore`, `package.json`.
- Core editor source touched by the completed pass: `src/editor.ts`, `src/commands.ts`, `src/dialogs.ts`, `src/image-upload.ts`.
- Test coverage touched by the completed pass: `test/editor.test.ts`, `test/commands.test.ts`.
- Build, size, and demo support: `scripts/build.mjs`, `scripts/check-size.mjs`, `demo/index.html`.
- Long-lived planning context: `docs/tasks/*.md`, especially the original codebase improvement plan.

## Current Baseline

Overall risk level: **Low to Medium**.

The highest-risk behavioral items from the original review have been completed and covered by tests. The codebase remains a focused TypeScript package around ProseMirror with DOM-built toolbar/dialog controls, schema-backed HTML import/export, and sanitizer helpers. The most useful next work is no longer broad behavior hardening. It is to make release and integration steps repeatable, confirm distribution assumptions, and do one browser-level smoke pass before relying on the ignored `dist/` release artifact workflow.

## Completed Work Snapshot

The following items are no longer active tasks:

- `dist/` is ignored during normal development, and generated assets are intended to be attached to GitHub Releases instead of reviewed in every source change.
- Editor construction silently writes the initial textarea value without firing host dirty/autosave notifications; real edits, `setHTML(...)`, and explicit `syncToTextarea()` still notify the host.
- Async image uploads now keep an upload-specific selection bookmark instead of reusing the shared dialog selection.
- URL upload responses now normalize invalid JSON, missing image URL, HTTP failure, and unsafe URL errors.
- Table insertion now keeps the cursor in the newly inserted table when earlier tables already exist.
- Switching between bullet and ordered lists now converts the current list type.
- Unsupported custom schema injection was removed from `MoongladeEditorOptions`.
- Link, code, and source dialogs now support Escape-to-close, and source save returns focus to the editor.

Latest completed verification from the hardening pass:

| Date | Check | Result | Notes |
| --- | --- | --- | --- |
| 2026-07-02 | `npm test` | Passed | 4 test files, 64 tests. |
| 2026-07-02 | `npm run build` | Passed | Type declarations, bundles, and JS/CSS size checks passed; `dist/` output is ignored by Git. |

## Active Issues

| ID | Priority | Type | Location | Issue | Impact | Evidence | Recommended Direction |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R-01 | P2 | Release / integration | `README.md`, `AGENTS.md`, `package.json`, `dist/` | The project now relies on ignored local `dist/` output being attached to GitHub Releases, but the exact release artifact checklist is still informal. | A release could accidentally omit CSS, declarations, source maps, or use stale locally generated assets. Moonglade integration would then depend on manual recovery. | `README.md` and `AGENTS.md` state that `dist/` is ignored and release artifacts should be attached to GitHub Releases, while no dedicated release checklist or release task record exists yet. | Add a small release checklist or release task record that names the build command, artifact list, smoke checks, and manual Moonglade copy expectation. Avoid automation until the manual process is proven. |
| R-02 | P2 | Release / legal | `package.json`, `README.md`, `AGENTS.md` | The package is still marked `UNLICENSED`, but the current strategy includes distributing build artifacts through GitHub Releases. | Public or independent distribution may be unclear until the intended license is chosen. | `package.json` has `"license": "UNLICENSED"`; `README.md` and `AGENTS.md` both say to choose a license before independent distribution. | Ask the owner to choose whether releases are private/internal only or which public license should apply before public distribution. Treat license changes as a separate confirmed task. |
| R-03 | P3 | QA / release confidence | `demo/index.html`, browser runtime | The completed behavior changes are covered by jsdom/unit tests, but the updated dialog, focus, upload, table, list, and source-mode flows have not yet had a fresh browser demo smoke pass in this baseline. | Unit tests can miss real browser focus, selection, and layout behavior. | The latest verification is `npm test` and `npm run build`; no browser smoke entry was added after the Step 7/8 pass. Prior task records show browser smoke checks are the project convention for interaction-heavy changes. | Before release, run a demo smoke pass against the built assets and record the result in this task file or a release task record. |
| R-04 | P3 | Maintainability | `src/editor.ts`, `src/toolbar.ts`, `test/editor.test.ts` | The largest files still concentrate several responsibilities. This is manageable, but future changes may become harder to review if these files keep growing. | Moderate long-term maintenance cost, but no current correctness issue. | Current line counts: `src/editor.ts` 375 lines, `src/toolbar.ts` 363 lines, `test/editor.test.ts` 617 lines. `editor.ts` owns lifecycle, transactions, toolbar wiring, dialogs, upload, source mode, and textarea sync. | Defer broad refactoring. If future edits touch the same areas, consider small internal extractions with no public API change and full test/build verification. |

## Remaining Task Breakdown

| No. | Task | Related issues | Dependencies | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| A | Define the release artifact checklist | R-01 | Current ignored-`dist` decision | Documentation review; optionally `npm run build` when validating artifact names | Not started |
| B | Decide distribution/license policy before public release | R-02 | Owner decision | `package.json`/README/AGENTS consistency if a license changes | Waiting for confirmation |
| C | Run and record a browser demo smoke pass | R-03 | Built assets from `npm run build` | Browser smoke check for dialog Escape/focus, source save, list conversion, table insertion, image upload error display, and mobile layout sanity | Not started |
| D | Optional small maintainability extraction | R-04 | Prefer after release checklist and smoke pass | Focused tests plus `npm test` and `npm run build` | Deferred |

## Detailed Improvement Plan

### Task A: Define the release artifact checklist

- **Priority**: P2
- **Related issues**: R-01
- **Goal**: Make the ignored-`dist` release strategy repeatable and reviewable.
- **Change scope**: Add or update a small release checklist in docs, naming the build command, artifact list, verification checks, and manual Moonglade copy expectation.
- **Not included**: GitHub Actions automation, dependency upgrades, Moonglade repository changes, committing `dist/`.
- **Expected result**: A maintainer can build the package, attach the correct artifacts to a GitHub Release, and know what to copy into Moonglade without relying on conversation history.
- **Verification**: Review the checklist against `package.json` exports and `scripts/build.mjs`; optionally run `npm run build` only when validating generated artifact names.
- **Release risk**: Low.
- **Rollback plan**: Revert the documentation-only checklist.
- **Needs user confirmation**: No for a manual checklist; yes before adding release automation.
- **Questions to confirm**: None for the checklist.

### Task B: Decide distribution/license policy before public release

- **Priority**: P2
- **Related issues**: R-02
- **Goal**: Clarify whether GitHub Release artifacts are private/internal only or require a public distribution license.
- **Change scope**: Owner decision first; if a license is chosen, update `package.json`, README, and relevant docs in one focused change.
- **Not included**: Dependency upgrades, package publishing, legal advice, release automation.
- **Expected result**: The repository no longer has ambiguous distribution guidance before public or independent release.
- **Verification**: Confirm `package.json` license and docs agree. If only a private/internal policy is chosen, document that policy without changing the package license.
- **Release risk**: Medium if public distribution begins without a decision; low for documentation/package metadata once confirmed.
- **Rollback plan**: Revert license/documentation metadata changes if the owner changes direction before release.
- **Needs user confirmation**: Yes.
- **Questions to confirm**: Should releases remain private/internal only, or should the project adopt a public license? If public, which license?

### Task C: Run and record a browser demo smoke pass

- **Priority**: P3
- **Related issues**: R-03
- **Goal**: Verify the latest interaction changes in a real browser before release.
- **Change scope**: Run the demo against built assets and record the result in the task/release notes.
- **Not included**: Product UI redesign, new features, large accessibility overhaul.
- **Expected result**: Browser-level confidence for selection, focus, source mode, list/table commands, upload error display, and responsive layout after the completed hardening work.
- **Verification**: `npm run build`, serve or open the demo, check console health, exercise the listed flows, and capture the result in docs.
- **Release risk**: Low.
- **Rollback plan**: If the smoke pass exposes a bug, open a focused follow-up task and do not release until fixed.
- **Needs user confirmation**: Yes before running build/browser commands if you want to keep this turn documentation-only.
- **Questions to confirm**: None once command execution is allowed.

### Task D: Optional small maintainability extraction

- **Priority**: P3
- **Related issues**: R-04
- **Goal**: Reduce future review risk only where a small internal extraction clearly helps.
- **Change scope**: Possible examples include upload selection helpers, dialog helper tests, or toolbar state mapping. Keep all changes internal.
- **Not included**: Public API changes, schema changes, framework migration, folder-wide restructuring, dependency changes.
- **Expected result**: Slightly smaller focused units with unchanged behavior.
- **Verification**: Focused tests for extracted helpers where useful, plus `npm test` and `npm run build`.
- **Release risk**: Low if tiny and mechanical; medium if it grows beyond one clear responsibility.
- **Rollback plan**: Revert the extraction commit.
- **Needs user confirmation**: No for tiny internal extractions; yes for public API or directory-structure changes.
- **Questions to confirm**: None now.

## Recommended Execution Order

1. Task A: Define the release artifact checklist.
2. Task B: Decide distribution/license policy before any public release. This can happen in parallel with Task A if the owner already knows the answer.
3. Task C: Run and record a browser demo smoke pass against the built assets.
4. Task D: Consider small maintainability extraction only after release flow and smoke confidence are in place, or when a future feature naturally touches the same code.

## Suggested Next Task

Start with **Task A: Define the release artifact checklist**.

Reason: the earlier source-level issues are now covered, and the biggest remaining practical risk is that ignored `dist/` output makes releases depend on memory. A short checklist is low-risk, immediately useful, and gives later browser smoke checks and Moonglade copy steps a stable target.

## Deferred / Not Recommended Now

- Do not commit `dist/` in normal feature branches unless the project explicitly reverses the current release strategy.
- Do not introduce release automation before the manual release checklist has been used at least once.
- Do not perform a broad editor framework migration; the current direct ProseMirror and DOM approach matches the project contract.
- Do not add broad word-processor features such as Office paste cleanup, emoji insertion, collaboration, or media library support unless separately requested.
- Do not upgrade dependencies without a specific security, compatibility, or integration reason.
- Do not split large files just for size. Extract only when a focused change proves a clearer internal boundary.

## Open Questions

- Should GitHub Release artifacts be treated as private/internal-only, or should the package adopt a public distribution license?
- If public distribution is intended, which license should be used?
- After the manual release checklist exists, should release packaging remain manual or move to GitHub Actions?

## Confirmed Decisions

- 2026-07-02: `dist/` should be ignored during normal development, generated for release, attached to GitHub Releases, and manually copied into Moonglade when needed.
- 2026-07-02: Host dirty/autosave capability must be preserved. Initialization should avoid false dirty signals while real edits remain observable.
- 2026-07-02: Switching between bullet and ordered lists should convert the current list type.
- 2026-07-02: Custom ProseMirror schema injection should not be supported as part of the public API.

## Notes for Future Execution

- Read `AGENTS.md` before making changes.
- Do not edit `dist/` by hand; update source/build scripts and rebuild only for verification or release packaging.
- For behavior changes, add or update tests first or in the same task, then run `npm test` and `npm run build`.
- For documentation-only changes, full build is usually not required; review the Markdown diff.
- Keep changes focused and independently committable.
- Preserve sanitizer and schema constraints; do not weaken safe URL, style, alignment, image, or source-mode handling.
- Avoid unrelated formatting churn.
- If a task changes commands, dependencies, architecture, public API, or integration flow, update README/AGENTS/docs as part of that task.
