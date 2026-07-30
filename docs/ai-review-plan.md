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
- **Status**: DONE (2026-07-18). I8: `handleImageDrop` now mirrors `handleImagePaste` — when an image is dropped without a configured uploader it `preventDefault`s and shows `Image upload is not configured.` instead of silently ignoring. I7: `updateToolbarState` computes `getCurrentAlignment` once and reuses cached command instances (`alignmentCommands` for the four alignments + `insertTableCommand`) created in the constructor instead of rebuilding them each toolbar update. Verified: `npm test` (93 passing), `npm run build` (within size budgets). Note: a jsdom unit test for the drop path was attempted but removed — ProseMirror's internal drop handler calls `posAtCoords`/`elementFromPoint` before the `handleDrop` prop, which jsdom cannot satisfy without heavy layout mocking; the analogous paste status path remains covered.

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
- **Status**: DONE (2026-07-18). Added a "two upload options use different response shapes" section to `README.md` after the `uploadImage` example: `uploadImage(file)` resolves to `{ src, alt?, title? }`; `uploadUrl` posts multipart form-data (field `file`, `same-origin`, `Accept: application/json`) and expects `{ location, filename?, title? }`, mapped to `src`/`alt` (fallback to file name)/`title`, with missing `location` or non-JSON treated as an error. Docs-only, no code change.

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

---

# 2026-07-30 AI Code Review Refresh & Improvement Plan

本节是 2026-07-30 对当前代码库的只读复核结果。复核期间只查看文件和搜索代码；未修改业务代码、配置、测试、依赖或生成文件。本节追加到现有 AI 记忆文件，供后续分批执行和恢复上下文使用。

## 1. 分析日期

- 2026-07-30

## 2. 分析范围

主要查看范围：

- `src/editor.ts`：富文本编辑器生命周期、textarea/onChange 同步、上传、toolbar 状态、ProseMirror 插件。
- `src/code-editor.ts`：CodeMirror 公共 Markdown/HTML/CSS 模式、同步、格式化、只读、状态提示。
- `src/markdown-image-upload.ts`：Markdown 模式图片 paste/drop 上传、Markdown 图片文本生成。
- `src/image-upload.ts`：富文本图片上传 URL 与扩展名过滤。
- `src/html.ts`、`src/safety.ts`、`src/schema.ts`、`src/commands.ts`：HTML 解析/序列化、安全边界、schema 与命令。
- `src/source-code-editor.ts`、`src/code-formatter.ts`、`src/code-formatter-runtime.ts`：HTML source dialog 与 lazy formatter。
- `test/*.test.ts`：现有覆盖范围，尤其是富文本与统一入口测试。
- `scripts/build.mjs`、`scripts/check-size.mjs`、`demo/index.html`、`README.md`、`package.json`。

未执行范围：

- 未运行 `npm test`、`npm run build`、`npm audit` 或任何可能产生副作用/联网/写文件的命令。
- 未深入验证真实浏览器交互、bundle 体积、依赖安全公告或主 Moonglade 集成行为。

## 3. 总体结论

- 整体风险等级：**中**。
- 当前富文本核心路径经过上一轮改进后结构和安全边界较清晰，`safety.ts`、`html.ts`、`schema.ts` 的职责划分合理，富文本测试覆盖也较强。
- 最值得优先处理的问题：
  1. Markdown 图片上传结果 URL 只校验非空，未复用富文本图片 URL sanitizer。
  2. 公共 CodeMirror 模式测试覆盖明显不足，后续改动缺少保护网。
  3. `MoongladeCodeEditor` 每次文档变化会重复读取完整文档字符串，长 Markdown/HTML/CSS 文本下存在高概率性能浪费。
  4. 富文本与代码编辑器公共 API 的生命周期/输入校验一致性不足。
- 暂不建议现在处理：大规模重构编辑器类、替换 ProseMirror/CodeMirror、引入新 sanitizer/SPA 框架、无明确安全公告的依赖升级。

## 4. 问题列表

| ID | 优先级 | 类型 | 位置 | 问题描述 | 影响 | 证据 | 建议方向 |
|---|---|---|---|---|---|---|---|
| R1 | P1 | 安全 / 稳定性 | `src/markdown-image-upload.ts` `createMarkdownImageText` / `assertUploadUrl` | Markdown 图片上传返回的 URL 只要求是非空字符串，未使用 `sanitizeImageUrl` 或等价协议过滤。 | 如果上传回调被误配或服务端返回异常值，编辑器会把 `javascript:`、`data:` 等 URL 写入 Markdown 图片语法；后续渲染器若不安全，可能扩大为 XSS 或内容污染。 | `createMarkdownImageText` 直接拼接 `formatMarkdownUrl(result.url)`；`assertUploadUrl` 仅检查 `typeof result.url === 'string' && result.url.length > 0`。 | 对 Markdown 上传结果复用 `sanitizeImageUrl`，拒绝不安全 URL；补充回归测试。 |
| R2 | P1 | 测试覆盖 / 可维护性 | `test/`，`src/code-editor.ts`，`src/markdown-image-upload.ts` | 公共 CodeMirror 模式缺少专门测试。 | Markdown/HTML/CSS 模式涉及公共 API、textarea 同步、格式化、只读和图片上传；缺少测试会让后续性能/安全修复风险变高。 | 文件列表中没有 `test/code-editor.test.ts` 或 `test/markdown-image-upload.test.ts`；`test/unified-editor.test.ts` 仅覆盖创建 Markdown 编辑器并断言 `getValue()` 和初始 textarea。 | 先增加 code-like 模式的测试基线，再改行为。 |
| R3 | P2 | 性能 / 稳定性 | `src/code-editor.ts` `EditorView.updateListener` / `syncToTextarea` | 每次 CodeMirror 文档变化都会至少两次读取完整文本：`syncToTextarea()` 调 `getValue()`，随后 `onChange?.(this.getValue())` 再读一次。 | 长 Markdown、raw HTML、CSS 编辑时，按键路径存在重复 O(n) 字符串生成；对富文本已做 debounce，但代码模式仍是同步重复读取。 | `updateListener` 在 `docChanged` 时执行 `this.syncToTextarea(); this.onChange?.(this.getValue());`，`syncToTextarea()` 内部又执行 `this.textarea.value = this.getValue()`。 | 第一阶段改为每次变化只读一次字符串并复用；是否做 debounce 需确认 host 对同步 `onChange` 的依赖。 |
| R4 | P2 | API 稳定性 / 生命周期 | `src/editor.ts` `MoongladeEditor.destroy`，对比 `src/code-editor.ts` | 富文本编辑器没有 `destroyed` guard，`destroy()` 不是显式幂等；销毁后继续调用公共方法没有统一错误。 | 宿主重复销毁、异步回调或页面切换中可能触发不一致状态；代码编辑器已经有幂等销毁和 `ensureActive()`，两个公共实例行为不一致。 | `MoongladeEditor.destroy()` 直接 remove listener、flush sync、clear previews、destroy sourceEditor/view；`MoongladeCodeEditor.destroy()` 有 `if (this.destroyed) return`，公共方法调用 `ensureActive()`。 | 为富文本编辑器增加最小 `destroyed` guard；优先保证 `destroy()` 幂等，再视需要统一公共方法错误。 |
| R5 | P2 | 鲁棒性 / API 校验 | `src/editor.ts` constructor，`src/code-editor.ts` `assertEditorOptions` | 富文本编辑器缺少与代码编辑器相当的运行时 options 校验。 | JS 消费者传错 `element`、`textarea`、`content`、`onChange` 等值时会得到不稳定或难定位的运行时错误。 | 富文本 constructor 直接使用 `options.element.classList.add`、`options.element.replaceChildren`；代码编辑器在 `assertEditorOptions` 中校验 element、textarea、content、height、boolean、tabSize、onChange 等。 | 增加小而明确的富文本 options 校验，复用代码编辑器风格的 TypeError 文案。 |
| R6 | P2 | API 一致性 / 待确认 | `src/markdown-image-upload.ts` `getImageFiles` / `isImageFile`，`src/image-upload.ts` | Markdown 图片上传没有可配置扩展名过滤，且默认接受更多格式；富文本路径有 `allowedImageExtensions`。 | 主持人可能认为 `allowedImageExtensions` 覆盖所有图片 paste/drop 流程，但 Markdown 路径当前按 MIME 或文件名接受 `avif/bmp/gif/svg/webp` 等。 | Markdown `imageFileNamePattern = /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i`，`isImageFile` 接受任意 `file.type.startsWith('image/')`；富文本 `DEFAULT_ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.png', '.webp', '.svg']` 且可配置。 | 需要确认是否希望 Markdown 上传也支持扩展名 allowlist；若确认，添加可选配置并保持兼容默认。 |
| R7 | P3 | 结构 / 重复代码 | `src/code-editor.ts` 与 `src/source-code-editor.ts` | 两个 CodeMirror 包装器重复配置大量基础 extension 和 search panel 聚焦逻辑。 | 当前规模可接受，但后续继续增加 CodeMirror 能力时容易漂移。 | 两者都配置 line numbers、history、fold gutter、draw/drop cursor、rectangular selection、active line、indent/bracket/search/keymap，并各自实现 `focusSearchPanelField`。 | 不做大重构；等测试基线完成后，抽取小型 shared CodeMirror helper，只覆盖确实重复的基础项。 |
| R8 | P3 | Demo 安全 / 供应链 | `demo/index.html` | Demo 从 jsDelivr 加载 Bootstrap 与 Bootstrap Icons，没有 SRI；页面还使用内联脚本。 | Demo 若被公开部署，第三方资源供应链和 CSP 收紧能力较弱；仓库主包不受直接影响。 | `<link href="https://cdn.jsdelivr.net/...bootstrap...">` 无 `integrity`；demo 主逻辑在 `<script>` 内联。 | 若 demo 会公开托管，补 SRI 或自托管资源，并记录 demo CSP 取舍；若仅本地 demo，可保持低优先级。 |
| R9 | P3 | 文档 / 待确认 | `README.md`、`AGENTS.md`、`docs/ai-review-plan.md` | README 仍描述“On document changes” 同步，未明确富文本自动同步已有 200ms debounce；CodeMirror 模式同步策略也未区分。 | 集成方可能误解 `textarea` / `onChange` 的时序保证。 | README core flow 第 6 点写“On document changes, the editor serializes... syncs...”，而 `src/editor.ts` 使用 `TEXTAREA_SYNC_DEBOUNCE_MS = 200`。 | 文档说明：`getHTML()`/`syncToTextarea()` 立即，自动富文本同步 debounce；代码模式目前同步。 |

## 5. 分批次改进计划

### Task 1：建立 CodeMirror 公共模式测试基线

- **优先级**：P1
- **关联问题**：R2
- **目标**：先锁定 Markdown/HTML/CSS 模式当前公共行为，降低后续安全和性能改动风险。
- **改动范围**：新增或扩展 `test/`，建议新增 `test/code-editor.test.ts` 和必要的 Markdown 图片上传测试。
- **不包含的内容**：不改 `src/` 行为，不改依赖，不改构建脚本。
- **预期结果**：覆盖 `getValue`、`setValue`、textarea 同步、`onChange`、readOnly、语言切换、格式化 loader mock、Markdown paste/drop 上传成功与失败路径。
- **验证方式**：运行 `npm test`。
- **上线风险**：低。
- **回滚方案**：回退新增测试文件。
- **是否需要我确认**：是。
- **需要确认的问题**：是否允许运行 `npm test` 验证新增测试。
- **状态**：DONE (2026-07-30). Added `test/code-editor.test.ts` with 10 tests covering public code editor setup, height/textarea sync, `setValue` + `onChange`, language switching, read-only toolbar state, lazy formatter success/no-op paths, Markdown image paste upload success/failure, ignored image paste outside Markdown mode, and destroyed-instance errors. Verified with `npm test`: 6 test files, 107 tests passing.

### Task 2：校验 Markdown 图片上传返回 URL

- **优先级**：P1
- **关联问题**：R1
- **目标**：让 Markdown 上传插入路径与富文本图片 URL 安全边界一致。
- **改动范围**：`src/markdown-image-upload.ts`，测试文件。
- **不包含的内容**：不改变 Markdown 手工输入内容的保存策略；不引入新的 Markdown sanitizer；不改富文本上传路径。
- **预期结果**：`markdownImageUpload.upload` 返回 `javascript:`、`data:`、协议相对 URL 或空白 URL 时不插入图片，并走现有错误回调/状态提示。
- **验证方式**：`npm test`；新增用例覆盖安全 URL、非法 URL、错误回调。
- **上线风险**：低到中。若现有宿主依赖 `data:` 图片 URL，会被拒绝。
- **回滚方案**：回退 sanitizer 检查和对应测试。
- **是否需要我确认**：是。
- **需要确认的问题**：Markdown 上传是否允许 `data:image/*` 或协议相对 URL？当前富文本图片 URL 均不允许，建议 Markdown 保持一致。
- **依赖关系**：建议依赖 Task 1。
- **状态**：DONE (2026-07-30). Maintainer confirmed Markdown image upload URLs should match rich HTML image URL policy. `src/markdown-image-upload.ts` now normalizes upload result URLs through `sanitizeImageUrl`, rejects unsafe upload result URLs with a clear `TypeError`, and preserves the sanitized URL for Markdown insertion. Added `test/code-editor.test.ts` coverage for unsafe upload result URLs and adjusted the success case to use a sanitizer-safe URL that still exercises Markdown angle-bracket URL formatting. Verified: `npm test` (6 files, 108 tests passing), `npm run build` (types, bundle, and size budgets passing).

### Task 3：减少 CodeMirror 文档变化时的重复完整文本读取

- **优先级**：P2
- **关联问题**：R3
- **目标**：在不改变同步时序的前提下，消除每次编辑两次 `doc.toString()` 的浪费。
- **改动范围**：`src/code-editor.ts` 的 `updateListener`、`syncToTextarea` 或新增内部 `writeEditorValue(value, notifyHost)`。
- **不包含的内容**：不引入 debounce，不改变 `onChange` 同步触发时机。
- **预期结果**：每次 `docChanged` 只读取一次完整文本，同时 textarea 和 `onChange` 保持现有同步行为。
- **验证方式**：`npm test`；新增或复用 Task 1 的同步测试。
- **上线风险**：低。
- **回滚方案**：回退到当前 `syncToTextarea()` + `onChange?.(getValue())`。
- **是否需要我确认**：否。
- **需要确认的问题**：无。
- **依赖关系**：依赖 Task 1。

### Task 4：确认并可选优化 CodeMirror 自动同步时序

- **优先级**：P2
- **关联问题**：R3、R9
- **目标**：判断代码类模式是否也应该像富文本一样 debounce textarea/onChange 自动同步。
- **改动范围**：待确认后可能涉及 `src/code-editor.ts`、测试、README。
- **不包含的内容**：不改变 `getValue()` 和显式 `syncToTextarea()` 的即时语义。
- **预期结果**：若确认可 debounce，长 Markdown/HTML/CSS 输入更流畅；若不能 debounce，则保留同步但文档化。
- **验证方式**：`npm test`；手动长文档输入检查；必要时 demo 浏览器检查。
- **上线风险**：中。会改变宿主收到 `onChange` 的时间。
- **回滚方案**：恢复同步自动写入。
- **是否需要我确认**：是。
- **需要确认的问题**：主 Moonglade 或其他宿主是否依赖 CodeMirror 模式每次按键同步触发 `onChange`/textarea `input`？
- **依赖关系**：依赖 Task 1 和 Task 3。

### Task 5：补齐富文本编辑器生命周期防护

- **优先级**：P2
- **关联问题**：R4
- **目标**：让 `MoongladeEditor.destroy()` 显式幂等，避免重复销毁或销毁后异步路径导致状态异常。
- **改动范围**：`src/editor.ts`，相关测试。
- **不包含的内容**：不重构 editor class；不改 public API 名称。
- **预期结果**：重复 `destroy()` 不抛异常；销毁后的主要公共方法行为明确并有测试。
- **验证方式**：`npm test`；新增重复 destroy 和销毁后调用行为测试。
- **上线风险**：低。
- **回滚方案**：移除 `destroyed` guard 和测试。
- **是否需要我确认**：否。
- **需要确认的问题**：无。
- **依赖关系**：无。

### Task 6：补齐富文本 options 运行时校验

- **优先级**：P2
- **关联问题**：R5
- **目标**：改善 JS 消费者误用 API 时的错误可诊断性，并与 `MoongladeCodeEditor` 保持一致。
- **改动范围**：`src/editor.ts`，相关测试。
- **不包含的内容**：不扩大配置项，不修改 TypeScript 类型定义的语义。
- **预期结果**：错误的 `element`、`textarea`、`content`、`height`、`spellcheck`、`uploadImage`、`onChange` 等输入得到明确 `TypeError`。
- **验证方式**：`npm test`；新增 options 校验测试。
- **上线风险**：低到中。少数依赖错误输入“碰巧可用”的宿主会更早失败。
- **回滚方案**：回退校验函数和测试。
- **是否需要我确认**：否。
- **需要确认的问题**：无。
- **依赖关系**：无。

### Task 7：确认 Markdown 图片扩展名 allowlist 策略

- **优先级**：P2
- **关联问题**：R6
- **目标**：澄清 Markdown 图片上传是否应继承或拥有类似 `allowedImageExtensions` 的客户端过滤。
- **改动范围**：待确认后可能涉及 `src/code-editor-options.ts`、`src/markdown-image-upload.ts`、README、测试。
- **不包含的内容**：不改变服务端必须校验文件内容的原则；不处理富文本上传。
- **预期结果**：Markdown paste/drop 上传格式限制与项目文档一致，避免宿主误解。
- **验证方式**：`npm test`；新增允许/拒绝扩展名测试。
- **上线风险**：中。默认收紧会影响 GIF/AVIF/BMP 等当前可上传文件。
- **回滚方案**：恢复当前 `imageFileNamePattern` 和 MIME 判断。
- **是否需要我确认**：是。
- **需要确认的问题**：Markdown 模式默认允许格式应与富文本一致，还是保持当前更宽松集合？
- **依赖关系**：建议在 Task 2 后执行。

### Task 8：小范围抽取 CodeMirror 共享 helper

- **优先级**：P3
- **关联问题**：R7
- **目标**：只在测试保护下减少 `code-editor.ts` 与 `source-code-editor.ts` 的明显重复。
- **改动范围**：可新增 `src/code-editor-shared.ts` 或类似小模块，提取基础 extension builder 和 search panel focus helper。
- **不包含的内容**：不合并两个 editor class；不改变 toolbar 或 formatter 行为。
- **预期结果**：重复逻辑减少，两个 CodeMirror 包装器仍保持各自职责。
- **验证方式**：`npm test`；`npm run build`；source dialog 和 code-like mode demo 检查。
- **上线风险**：低到中。
- **回滚方案**：回退 helper 提取。
- **是否需要我确认**：否。
- **需要确认的问题**：无。
- **依赖关系**：依赖 Task 1。

### Task 9：文档同步富文本与代码模式同步语义

- **优先级**：P3
- **关联问题**：R9
- **目标**：让 README 准确描述 `getHTML()`、`getValue()`、`syncToTextarea()`、自动 `onChange` 的同步/异步行为。
- **改动范围**：`README.md`，必要时 `docs/`。
- **不包含的内容**：不改运行时代码。
- **预期结果**：集成方能明确知道富文本自动同步有 debounce，显式同步立即；代码模式当前同步或按 Task 4 的结果更新。
- **验证方式**：Markdown diff review。
- **上线风险**：低。
- **回滚方案**：回退文档变更。
- **是否需要我确认**：否。
- **需要确认的问题**：若 Task 4 未确认，先只记录当前行为。
- **依赖关系**：最好在 Task 4 决策后执行。

### Task 10：按 demo 发布方式决定是否补 SRI/CSP 说明

- **优先级**：P3
- **关联问题**：R8
- **目标**：如果 demo 会公开托管，则降低第三方 CDN 资源风险；如果只本地使用，则文档说明即可。
- **改动范围**：`demo/index.html` 或 README/demo docs。
- **不包含的内容**：不改变编辑器包产物。
- **预期结果**：公开 demo 有 SRI 或自托管资源；本地 demo 则明确不作为生产安全模板。
- **验证方式**：浏览器打开 demo；Markdown review。
- **上线风险**：低。
- **回滚方案**：恢复 demo link/script。
- **是否需要我确认**：是。
- **需要确认的问题**：`demo/index.html` 是否会公开部署，还是只作为本地开发页面？

## 6. 建议执行顺序

1. Task 1：先建立 CodeMirror 公共模式测试基线。
2. Task 2：修复 Markdown 上传 URL 安全边界。
3. Task 3：不改变时序地消除 CodeMirror 重复全文读取。
4. Task 5：补齐富文本编辑器 destroy 生命周期防护。
5. Task 6：补齐富文本 options 运行时校验。
6. Task 4：在确认宿主时序依赖后，决定是否 debounce CodeMirror 自动同步。
7. Task 7：确认并实现 Markdown 图片扩展名 allowlist 策略。
8. Task 9：同步 README/文档中的同步语义。
9. Task 8：最后做低优先级 CodeMirror helper 抽取。
10. Task 10：根据 demo 发布方式处理 SRI/CSP 或文档说明。

## 7. 暂不建议处理的事项

- 不建议大规模拆分 `MoongladeEditor` 或 `MoongladeCodeEditor`。当前文件虽然偏大，但职责仍可追踪；优先做小型生命周期、校验和测试补强。
- 不建议替换 ProseMirror、CodeMirror 或 Prettier。当前选型符合项目目标，替换成本和风险远高于收益。
- 不建议引入新的 HTML sanitizer 依赖来替代现有 schema/safety 边界。当前富文本安全路径已经集中，新增依赖会增加 bundle 和维护成本；若未来发现 sanitizer 覆盖不足，再单独评估。
- 不建议盲目升级依赖。本轮未执行 `npm audit` 或查询安全公告，因此不能基于猜测提出升级任务。
- 不建议马上收紧 arbitrary class passthrough。上一轮记录显示维护者已确认这是设计选择。
- 不建议现在强制 Trusted Types/CSP 改造。它是长期安全加固方向，但会影响宿主集成方式，需单独确认生产部署策略。

## 8. 当前未确认的问题和需要维护者回答的问题

All questions were answered on 2026-07-30:

1. Running `npm test` and `npm run build` for future validation: **Allowed.**
2. Markdown upload result URL policy: **Keep consistent with rich HTML image URLs**; allow only safe relative URLs, `http:`, and `https:`, and reject `data:`, protocol-relative URLs, and script-like protocols.
3. CodeMirror mode automatic `textarea`/`onChange` sync timing: **Short debounce is allowed.**
4. Markdown upload default image extension policy: **Keep consistent with rich HTML defaults.**
5. `demo/index.html` deployment: **Will not be publicly deployed.** SRI/CSP changes for the demo are not needed unless this changes later.

## 9. 后续执行注意事项

- 本轮只产出问题和计划；后续执行修复前应按任务单独提交、单独验证。
- 不要编辑 `dist/`；如需验证 build，应运行构建但不提交生成文件，除非发布策略明确要求。
- 安全相关改动优先保持现有 public API，不引入新依赖，先复用 `safety.ts`。
- 修改 Markdown 上传行为前，要明确这是“上传插入路径”的安全约束，不是对用户手写 Markdown 全文做 sanitizer。
- 任何改变 `onChange` 或 textarea 自动同步时序的改动，都必须先确认宿主兼容性，并在 README 记录。
- 如果后续发现依赖漏洞，应单独创建依赖安全任务，不与重构或功能改动混在一起。
