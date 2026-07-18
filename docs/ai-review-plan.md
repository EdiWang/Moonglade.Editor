# AI Code Review & Improvement Plan

This file is an AI memory / long-term context file. It records a code review of the
Moonglade.Editor package and a staged, testable improvement plan. It is analysis-only:
no business code, config, tests, or dependencies were changed in the review that
produced this file.

## 1. Analysis Date

- 2026-07-18

## 2. Analysis Scope

Reviewed source, tests, build scripts, and package metadata:

- `src/editor.ts` (MoongladeEditor class, upload preview plugin, spellcheck plugin)
- `src/html.ts` (parse/serialize + HTML formatting)
- `src/safety.ts` (URL/style/class/align/code-language sanitizers)
- `src/schema.ts` (ProseMirror schema, marks, alignment, class handling)
- `src/commands.ts` (editor commands)
- `src/editor-state.ts` (toolbar state helpers)
- `src/editor-options.ts` (block formats, palette, code languages)
- `src/image-upload.ts` (upload contract + extension filtering)
- `src/dialogs.ts` (link/code/image/source dialogs)
- `src/toolbar.ts` + `src/toolbar/*` (framework-free toolbar modules)
- `src/index.ts` (public export surface)
- `test/*.test.ts`, `scripts/check-size.mjs`, `package.json`

Not deeply reviewed: `src/styles.css` (visual), `demo/index.html`,
`scripts/upload-test-server.mjs` (dev-only), `scripts/build.mjs` (only scanned).

## 3. Overall Conclusion

- Overall risk level: **Low–Medium**.
- Code is clean, well-modularized, strongly typed, and follows a consistent style.
  Security-critical input handling (URLs, colors, code language, alignment, classes)
  is centralized in `safety.ts` and generally correct.
- Highest-value items to consider first:
  1. Harden `parseHtml` against pre-sanitization resource loads (innerHTML race) — P2 security (approach explained to maintainer; awaiting final go on inert-DOMParser method).
  2. Full-document HTML serialization on every keystroke — P2 performance for long posts. **Confirmed: short debounce is acceptable, no host relies on synchronous `onChange`.**
- Not recommended now: large architectural refactor of `MoongladeEditor`, dependency
  upgrades, or new abstractions. See section 6.

### Maintainer answers (2026-07-18)

1. `onChange`/textarea timing: short debounce acceptable; no host dependency on synchronous updates. → Task 3 unblocked.
2. HTML inert-parsing (I1): explanation + examples provided; maintainer decision on the inert-`DOMParser` approach still pending.
3. Arbitrary `class` passthrough (I10): **intentional by design — do NOT change.**
4. `.svg` uploads: keep enabled by default.
5. Running `npm test` / `npm run build` for validation: allowed.

## 4. Problem List

| ID | Priority | Type | Location | Description | Impact | Evidence | Direction |
|---|---|---|---|---|---|---|---|
| I1 | P2 | Security (待确认) | `src/html.ts` `parseHtml` | Untrusted HTML is assigned to `div.innerHTML` before `removeUnsafeAttributes` runs. In a live-document context this can start `img` loads and queue inline handlers before sanitization. | Possible SSRF/tracking pixel fetch and a race with `onerror`/`onload` on import/source-mode/paste. | `parseHtml` does `wrapper.innerHTML = html \|\| ''; removeUnsafeAttributes(wrapper);` | Parse into an inert document (`new DOMParser().parseFromString(html, 'text/html')` or a `<template>`), then sanitize, then hand the inert body to ProseMirror. Confirm browser behavior first. |
| I2 | P2 | Performance | `src/editor.ts` `dispatch` → `writeEditorValue` → `getHTML` | `serializeHtml` walks the whole doc, builds a DOM fragment, and string-formats on every `docChanged` transaction (every keystroke). | O(n) per keystroke; noticeable lag on long posts. | `dispatch()` calls `syncToTextarea()` when `transaction.docChanged`; `syncToTextarea` → `writeEditorValue(true)` → `getHTML()` → `serializeHtml`. | Debounce textarea/`onChange` serialization (confirmed acceptable) while keeping an explicit synchronous `syncToTextarea()`/`getHTML()`. |
| I3 | P2 | Maintainability | `src/editor.ts` (622 lines, `MoongladeEditor`) | Single class owns view setup, dialog orchestration, selection bookmarks, upload-preview lifecycle, object-URL tracking, and toolbar state. | Harder to read/test in isolation; large class. | One class holds `uploadPreviewUrls`, `addUploadPreview`/`removeUploadPreview`/`getUploadPreviewPosition`, plus dialog open/close and `updateToolbarState`. | Extract upload-preview + object-URL lifecycle into a small helper module; optionally extract toolbar-state syncing. Behavior-preserving. |
| I4 | P3 | Duplication | `src/commands.ts` `hasAncestor`; `src/editor-state.ts` `hasAncestor` | Two identical `hasAncestor(state, nodeType)` implementations. | Minor drift risk. | Both files define the same ancestor walk. | Export one from `editor-state.ts` and reuse in `commands.ts`. |
| I5 | P3 | Duplication | `src/editor-state.ts` `getPaletteColor` rgb regex; `src/safety.ts` `isSafeRgbColor` | The `rgb()/rgba()` parsing regex is duplicated. | Minor drift risk. | Both contain the same `rgba?\(...\)` pattern. | Share a single rgb parser/normalizer helper. |
| I6 | P3 | Performance | `src/editor.ts` `createCodeBlockSpellcheckPlugin` | Decoration provider walks the entire doc via `descendants` on every view update instead of mapping through transactions. | O(n) per render; only matters on large docs. | `decorations(state)` runs `state.doc.descendants(...)` each call. | Move to plugin state that maps decorations through `tr.mapping`, like the upload-preview plugin. |
| I7 | P3 | Performance / Readability | `src/editor.ts` `updateToolbarState` | Long method; recreates command instances (e.g. `commands.alignment('left')`, `commands.insertTable()`) and calls `getCurrentAlignment` multiple times on every keyup/mouseup/transaction. | Extra allocations on hot path; harder to scan. | Method spans ~60 lines with repeated `canRun(state, view, this.commands.alignment(...))` and four `getCurrentAlignment(state)` calls. | Compute `getCurrentAlignment` once; cache static command instances where they take no args. |
| I8 | P3 | UX / Consistency | `src/editor.ts` `handleImageDrop` vs `handleImagePaste` | Paste with no configured uploader shows an error status; drop with no uploader is silently ignored. | Inconsistent user feedback. | `handleImagePaste` sets `'Image upload is not configured.'`; `handleImageDrop` returns `false` early when `!this.uploadImage`. | Mirror the paste behavior (set upload status) on drop. |
| I9 | P3 | Robustness | `src/html.ts` `formatNode` / `formatHtml` | Serialized HTML is assembled by manual string concatenation (`openTag`, `escapeAttributeValue`, raw text-node output). Text nodes reaching the `TEXT_NODE` branch are output unescaped. | Currently safe because content-bearing text is emitted via `outerHTML`; fragile if the block/inline branching changes. | `formatNode` returns `node.textContent?.trim()` for text nodes; escaping only in `openTag`/attributes. | Add a regression test asserting entity escaping in formatted output; keep manual formatting but document the invariant. |
| I10 | — | Security (by design) | `src/safety.ts` `sanitizeClassAttribute` + `src/schema.ts` class passthrough | Imported HTML may retain arbitrary `class` tokens (≤128 chars each, ≤1024 total). | Not XSS. Maintainer confirmed this is intentional. | `sanitizeClassAttribute` keeps any token passing the char filter; schema `withNodeClass`/`withMarkClass` persist it. | **By design — do NOT change.** No action. |
| I11 | P3 | Contract clarity | `src/image-upload.ts` vs README/AGENTS | Built-in `uploadUrl` path expects a server response `{ location, filename, title }`, while the public `uploadImage` option returns `{ src, alt, title }`. | Two different shapes can confuse integrators. | `uploadImageToUrl` reads `result.location`/`result.filename`; `MoongladeImageUploadResult` uses `src`/`alt`. | Documentation-only: clarify both contracts in README. No code change needed. |

## 5. Staged Improvement Plan

Tasks are ordered to fix stability/security first, then verification, then low-risk
cleanups, then long-term polish. Each task is independently committable and testable.

### Task 1: Harden HTML import against pre-sanitization loads

- **Priority**: P2
- **Related problems**: I1
- **Goal**: Ensure untrusted HTML never triggers resource loads or inline handlers before sanitization.
- **Scope**: `src/html.ts` `parseHtml` only (switch to inert parsing, then sanitize, then feed ProseMirror).
- **Not included**: Serialization changes, schema changes, sanitizer signature changes.
- **Expected result**: Import/source-mode/paste produce identical sanitized docs, with parsing done in an inert document.
- **Verification**: `npm test` (add a test that a malicious `<img src=x onerror=...>` yields no active handler and a stripped/blocked src); browser-check source mode + paste.
- **Release risk**: Low–Medium (parsing path is core).
- **Rollback**: Revert `parseHtml` to the `innerHTML` implementation.
- **Needs my confirmation**: Yes
- **Questions to confirm**: Is inert `DOMParser().parseFromString(html, 'text/html')` acceptable, and are there host-tested edge cases (e.g. fragments without `<body>`) to preserve? Depends on nothing else.
- **Status**: DONE (2026-07-18). Approved by maintainer. Implemented via an inert `<template>` fragment (`template.innerHTML` → `removeUnsafeAttributes(template.content)` → ProseMirror parse). `removeUnsafeAttributes` now accepts `DocumentFragment | HTMLElement`. Verified: `npm test` (90 passing), `npm run types`, `npm run build` (within size budgets). No functional change to output.

### Task 2: Add regression tests for current safety/format invariants

- **Priority**: P1 (test-only, enables safe refactors)
- **Related problems**: Supports I1, I9, and future refactors
- **Goal**: Lock in current sanitization and serialization behavior before any refactor.
- **Scope**: `test/` only — cases for entity escaping in formatted output, unsafe-attribute stripping, and image/link URL blocking.
- **Not included**: Any `src/` change.
- **Expected result**: New passing tests documenting current guarantees.
- **Verification**: `npm test`.
- **Release risk**: Low (no shipped code changes).
- **Rollback**: Remove added tests.
- **Needs my confirmation**: No
- **Depends on**: None. Recommended before Tasks 1 and 4.
- **Status**: DONE (2026-07-18). Added to `test/html.test.ts`: text-content entity escaping, inline event-handler stripping, image event-handler stripping, `<script>` dropping. Suite 90 tests, all passing.

### Task 3: Make textarea/onChange serialization non-blocking on large docs

- **Priority**: P2
- **Related problems**: I2
- **Goal**: Avoid full-document serialization on every keystroke while preserving the sync contract.
- **Scope**: `src/editor.ts` `dispatch`/`writeEditorValue` (introduce debounced or idle serialization; keep `syncToTextarea()` synchronous/explicit).
- **Not included**: HTML format logic, schema, upload flow.
- **Expected result**: Typing stays responsive on long posts; `getHTML()`, explicit `syncToTextarea()`, and final content remain correct.
- **Verification**: `npm test` (existing sync tests must pass; add a test that `syncToTextarea()`/`getHTML()` are immediate and correct); manual typing check on a large doc.
- **Release risk**: Medium (changes when `onChange`/textarea update fires).
- **Rollback**: Revert to synchronous `syncToTextarea()` on every `docChanged`.
- **Needs my confirmation**: No (confirmed: short debounce acceptable, no host relies on synchronous updates)
- **Notes**: Keep `syncToTextarea()` and `getHTML()` synchronous/immediate; only the automatic per-keystroke `onChange`/textarea write is debounced. Flush any pending debounce on `destroy()` and on explicit `syncToTextarea()`.
- **Status**: DONE (2026-07-18). Implemented a 200ms debounce (`TEXTAREA_SYNC_DEBOUNCE_MS`) in `src/editor.ts`: `dispatch` now calls `scheduleTextareaSync()` on `docChanged`; `syncToTextarea()` cancels pending + writes immediately; `destroy()` flushes pending. `getHTML()` unchanged (immediate). Updated the edit-notification test to fake timers and added tests for rapid-edit coalescing and flush-on-destroy. Verified: `npm test` (92 passing), `npm run build` (within size budgets).

### Task 4: De-duplicate helpers (hasAncestor, rgb parsing)

- **Priority**: P3
- **Related problems**: I4, I5
- **Goal**: Single source of truth for `hasAncestor` and rgb color parsing.
- **Scope**: `src/commands.ts`, `src/editor-state.ts`, `src/safety.ts` (export/reuse existing helpers).
- **Not included**: Behavior changes; new features.
- **Expected result**: Identical behavior, less duplication.
- **Verification**: `npm test`; `npm run build`.
- **Release risk**: Low.
- **Rollback**: Re-inline the helpers.
- **Needs my confirmation**: No
- **Depends on**: Task 2 recommended first.
- **Status**: DONE (2026-07-18). `hasAncestor` now sourced only from `src/editor-state.ts` (removed the duplicate in `src/commands.ts`, which now imports it). Added shared `parseRgbColor` (+ `RgbColor` type) in `src/safety.ts`; `isSafeRgbColor` and `getPaletteColor` (`src/editor-state.ts`) both reuse it, removing the duplicated `rgba?()` regex. No behavior change. Verified: `npm test` (92 passing), `npm run build` (within size budgets). No import cycle (commands → editor-state → safety).

### Task 5: Convert code-block spellcheck plugin to mapped decorations

- **Priority**: P3
- **Related problems**: I6
- **Goal**: Avoid full-doc traversal per render.
- **Scope**: `src/editor.ts` `createCodeBlockSpellcheckPlugin`.
- **Not included**: Upload-preview plugin, other plugins.
- **Expected result**: Code blocks still render `spellcheck="false"`; fewer traversals.
- **Verification**: `npm test`; browser-check spellcheck disabled inside code blocks.
- **Release risk**: Low–Medium.
- **Rollback**: Revert to the per-render `descendants` implementation.
- **Needs my confirmation**: No
- **Status**: DONE (2026-07-18). `createCodeBlockSpellcheckPlugin` now uses plugin state keyed by `codeBlockSpellcheckPluginKey`: decorations are built once in `init` and recomputed in `apply` only when `transaction.docChanged` (selection-only updates reuse the cached `DecorationSet`). Full-doc `descendants` walk moved into a shared `buildCodeBlockSpellcheckDecorations(doc, schema)` helper. Added a test that code blocks inserted after init (`setHTML`) still get `spellcheck="false"`. Verified: `npm test` (93 passing), `npm run build` (within size budgets).

### Task 6: Extract upload-preview / object-URL lifecycle from MoongladeEditor

- **Priority**: P3
- **Related problems**: I3
- **Goal**: Shrink `MoongladeEditor` by moving preview + object-URL management into a focused module.
- **Scope**: `src/editor.ts` (+ optional new `src/upload-preview.ts`); behavior-preserving.
- **Not included**: Public API changes, upload contract changes.
- **Expected result**: Same behavior; smaller, more testable units.
- **Verification**: `npm test` (upload/paste/drop tests must pass); `npm run build` size budget.
- **Release risk**: Low–Medium.
- **Rollback**: Re-inline into the class.
- **Needs my confirmation**: No
- **Depends on**: Task 2 recommended first.
- **Status**: DONE (2026-07-18). Created `src/upload-preview.ts` owning `createUploadPreviewPlugin`, the preview plugin key/meta types, `UploadPreviewHandle`, object-URL create/revoke helpers, and a new `UploadPreviewManager` class (`add`/`remove`/`getPosition`/`clear`, view passed per call). `MoongladeEditor` now holds a single `private readonly uploadPreviews = new UploadPreviewManager()` instead of `nextUploadPreviewId` + `uploadPreviewUrls`, and delegates preview add/remove/position lookup plus `destroy()` cleanup to it. Behavior unchanged. Verified: `npm test` (93 passing), `npm run build` (within size budgets).

### Task 7: Minor consistency & readability polish

- **Priority**: P3
- **Related problems**: I7, I8
- **Goal**: Consistent drop-vs-paste feedback; tidy `updateToolbarState`.
- **Scope**: `src/editor.ts` (`handleImageDrop` status message; compute `getCurrentAlignment` once; reuse static command instances).
- **Not included**: New features.
- **Expected result**: Same UI states; slightly less work per toolbar update; consistent messaging.
- **Verification**: `npm test`; manual drag/drop + toolbar check.
- **Release risk**: Low.
- **Rollback**: Revert edits.
- **Needs my confirmation**: No

### Task 8 (docs-only): Clarify upload response contracts

- **Priority**: P3
- **Related problems**: I11
- **Goal**: Document both the `uploadImage` (`{src,alt,title}`) and `uploadUrl` server (`{location,filename,title}`) shapes.
- **Scope**: `README.md` (and/or `AGENTS.md` integration notes) — documentation only.
- **Not included**: Code changes.
- **Expected result**: Clear integrator guidance.
- **Verification**: Markdown review.
- **Release risk**: Low.
- **Rollback**: Revert docs.
- **Needs my confirmation**: No

## 6. Not Recommended Now

- Full architectural refactor of `MoongladeEditor` into many classes: current size is
  manageable; only the upload-preview extraction (Task 6) has clear payoff.
- Dependency upgrades: no security advisory or concrete benefit identified; AGENTS
  discourages speculative upgrades.
- Replacing manual HTML formatting in `html.ts` with a library: adds a dependency and
  bundle size for marginal gain; guard with a test instead (Task 2/I9).
- Restricting class passthrough to an allowlist (I10): **Maintainer confirmed arbitrary
  class passthrough is intentional — do not change.**
- Micro-optimizing `updateToolbarState` beyond Task 7: diminishing returns.

## 7. Open Questions For The Maintainer

All questions were answered on 2026-07-18:

1. `onChange`/textarea timing (Task 3 / I2): **Answered — short debounce acceptable, no host dependency.** Task 3 unblocked.
2. HTML parsing (Task 1 / I1): Explanation + examples provided. **Answered — approved, provided there is no negative functional impact (inert `DOMParser` parsing).**
3. Class passthrough (I10): **Answered — intentional by design, do NOT change.**
4. `.svg` uploads: **Answered — keep enabled by default.**
5. Running `npm test` / `npm run build`: **Answered — allowed.**

## 8. Execution Notes / Constraints For Future Work

- Do not edit generated `dist/`; change `src/` or build scripts and rebuild.
- Treat imported/source-mode/pasted HTML as untrusted; it must pass through the schema and `safety.ts`.
- Keep the public API small (`createMoongladeEditor` + narrow instance API); avoid new deps/abstractions.
- Split refactors, feature changes, security fixes, and dependency changes into separate tasks.
- For interaction-heavy changes, browser-check the demo (selection, tables, dialogs, drag/drop, paste, upload, source mode) in addition to `npm test`.
- Commit `package-lock.json` only if dependencies change.
- Ask before running commands with side effects (build/test/format/lint/install).
