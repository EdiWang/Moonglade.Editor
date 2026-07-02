# AGENTS.md

This file is for AI agents and engineers working in this repository. Read it before changing code, then inspect nearby implementation and tests to confirm the current local pattern.

## Project Purpose

Moonglade.Editor is a standalone, first-party rich text editor package for Moonglade. It exists so the main Moonglade ASP.NET Core repository can consume prebuilt static editor assets without adding a frontend build pipeline to that application.

The editor is built directly on ProseMirror and should stay focused on Moonglade's blog post editing needs:

- Headings H1-H6 and paragraphs.
- Bold, italic, underline, strikethrough.
- Text foreground and background color.
- Tables.
- Image upload and insertion.
- Code snippets.
- Links.
- Blockquotes.
- Horizontal rules.
- Bullet and numbered lists.
- Text alignment.
- HTML source view/edit.

Do not add broad word-processor features unless explicitly requested. In particular, do not add Word/Office paste cleanup, emoji insertion, special-symbol insertion, line-height controls, paragraph-spacing controls, collaboration, or a media library by default.

## Repository Contract

- Source code lives under `src/`.
- Browser-ready output is generated under `dist/` by the build.
- Tests live under `test/`.
- Demo files live under `demo/`.
- Long-lived project documentation lives under `docs/`.
- Complex task records should live under `docs/tasks/`.
- The main Moonglade repository should use prebuilt release artifacts generated from `dist/`; do not add a frontend build step to Moonglade.
- Keep the public API small and stable; prefer `createMoongladeEditor(...)` plus a narrow editor instance API.
- Keep generated output deterministic and suitable for publishing. `dist/` is ignored in normal development and should not be committed unless the project explicitly changes that release strategy.

This repository is a single TypeScript package, not a monorepo or multi-service workspace.

## Technology Stack

- Language: TypeScript.
- TypeScript version: `^5.8.3` in `package.json`.
- JavaScript target: ES2020 in `tsconfig.json` and `scripts/build.mjs`.
- Runtime environment: Browser DOM through ProseMirror `EditorView`.
- Node.js version: To be confirmed. No `engines` field is currently defined.
- Package manager: npm, with `package-lock.json` committed.
- Editor framework: ProseMirror core packages (`prosemirror-model`, `prosemirror-state`, `prosemirror-view`, commands, history, keymap, schema-list, tables, gapcursor).
- UI framework: No SPA framework. Toolbar/dialogs are built with DOM APIs and Bootstrap-compatible classes.
- Host UI dependencies: Bootstrap 5 CSS and Bootstrap Icons CSS are expected to be loaded by the consuming host page.
- Theme behavior: Custom editor styles use Bootstrap CSS variables and should inherit the nearest host `data-bs-theme` scope. Keep theme switching host-owned; do not add editor-specific theme APIs unless explicitly requested.
- Build tooling: esbuild via `scripts/build.mjs`; TypeScript declarations via `tsc -p tsconfig.build.json`.
- Testing: Vitest with jsdom.
- Type checking: `npm run types`.
- Bundle size checking: `scripts/check-size.mjs`, run by `npm run build`.
- Formatting: To be confirmed. No formatter script is currently configured.
- Linting: To be confirmed. No lint script is currently configured.
- Database/cache/message queue: None.
- Deployment/runtime service infrastructure: None in this package. The intended integration boundary is prebuilt static assets or a package artifact consumed by Moonglade.
- License: `UNLICENSED` in `package.json`; choose a publishing license before independent distribution.

## Code Architecture

Important directories:

- `src/` - TypeScript source for the editor package.
- `test/` - Vitest/jsdom unit tests for parsing, sanitization, commands, toolbar wiring, upload handling, and source mode.
- `scripts/` - Build and bundle size scripts.
- `dist/` - Ignored generated browser-ready JavaScript, CSS, source maps, and declaration files.
- `demo/` - Static demo page for manual browser checks.
- `docs/` - Long-lived handoff, task, and project documentation.

Key source modules:

- `src/index.ts` is the public package export surface.
- `src/editor.ts` owns `MoongladeEditor`, `createMoongladeEditor(...)`, `EditorView` setup, plugins, toolbar wiring, textarea sync, source updates, and image paste/drop/upload integration.
- `src/schema.ts` defines the ProseMirror schema, including alignment-aware paragraphs/headings, code block language attributes, table nodes, underline/strike marks, and constrained color marks.
- `src/html.ts` is the HTML import/export boundary. It removes unsafe URL/event attributes before schema parsing, adds lazy loading to serialized images, and newline-formats block-oriented output for source editing.
- `src/safety.ts` contains reusable sanitizers for links, image URLs, style color values, text alignment, and code language names.
- `src/commands.ts` defines editor commands for block formats, marks, links, colors, alignment, images, code blocks, lists, blockquotes, horizontal rules, history, and tables.
- `src/editor-state.ts` contains helpers for command availability and toolbar active-state detection.
- `src/toolbar.ts` creates the framework-free toolbar and color/image controls.
- `src/dialogs.ts` creates link, code snippet, and HTML source dialogs.
- `src/editor-options.ts` contains supported block formats, color palette values, and code language options.
- `src/image-upload.ts` contains upload URL and custom uploader integration.
- `src/styles.css` contains editor styles copied to `dist/moonglade-editor.css` by the build.

Core flow:

1. `createMoongladeEditor(options)` constructs `MoongladeEditor`.
2. Initial content comes from `options.content`, `options.textarea.value`, or an empty string.
3. `parseHtml(schema, html)` sanitizes incoming HTML attributes and parses content into the ProseMirror schema.
4. `EditorView` applies commands and transactions.
5. `dispatchTransaction` serializes changed docs with `serializeHtml(...)`, syncs the textarea, and calls `onChange`.
6. `setHTML(...)` and HTML source mode also re-enter through `parseHtml(...)`, preserving schema and sanitizer constraints.

## Public API Contract

Keep the main API centered on:

```ts
const editor = createMoongladeEditor({
  element,
  textarea,
  height: '500px',
  uploadUrl: '/image',
  spellcheck: true,
  content,
  onChange
});

editor.getHTML();
editor.setHTML(html);
editor.setSpellcheck(enabled);
editor.syncToTextarea();
editor.focus();
editor.destroy();
```

`uploadImage` can replace `uploadUrl` for custom upload behavior. Uploaded images must return a safe URL through `{ src, alt?, title? }`.

`height` defaults to `500px` and should accept ordinary CSS height values such as `px`, `vh`, and `calc(...)` strings.

Do not require Moonglade to understand ProseMirror JSON as the storage format unless the main project explicitly decides to change its content model.

## Development Rules

- Preserve the goal that Moonglade itself does not need npm, Vite, webpack, Rollup, or esbuild to run.
- Prefer explicit schema definitions and commands over large editor frameworks.
- Keep ProseMirror schema output compatible with Moonglade's existing public post renderer.
- Treat HTML source mode and pasted/imported HTML as untrusted input that must pass through the schema and sanitizer.
- Preserve safe URL handling for links and images. Reject script-like protocols.
- Keep image upload integration configurable through options; Moonglade will pass `/image`.
- Keep dependency licenses permissive and documented. Verify license changes before adding new dependencies.
- Commit `package-lock.json` whenever dependencies change.
- Do not edit generated `dist/` files by hand; update source or build scripts and rebuild for verification or release packaging.
- Avoid unrelated formatting churn.
- Keep code comments and developer-facing strings in English unless an existing localized resource explicitly requires another language.
- Use structured DOM/schema APIs where possible instead of ad hoc string manipulation.

## Configuration and Environment

No project-specific environment variables are currently defined.

Configuration files:

- `package.json` - package metadata, dependencies, npm scripts, export map.
- `package-lock.json` - npm dependency lockfile.
- `tsconfig.json` - shared TypeScript compiler settings for source, tests, scripts, and Vitest config.
- `tsconfig.build.json` - declaration-only TypeScript build output to `dist/`.
- `vitest.config.ts` - Vitest configuration using the `jsdom` environment.
- `scripts/build.mjs` - esbuild ESM/global bundles and CSS copy.
- `scripts/check-size.mjs` - size budgets for generated JavaScript and CSS artifacts.

If environment variables are added later, document each name, purpose, whether it is required, and an example format. Do not document real secrets.

## Common Commands

```powershell
npm install
npm run build
npm test
npm run dev
npm run size
```

Command meanings:

- `npm install` installs dependencies from `package-lock.json`.
- `npm test` runs Vitest in jsdom.
- `npm run types` emits declaration files only.
- `npm run bundle` runs esbuild and copies CSS.
- `npm run size` checks configured bundle size budgets.
- `npm run build` cleans `dist/`, emits declarations, bundles assets, and checks size budgets.
- `npm run dev` watches source files and rebuilds bundles/styles.

## Verification

For editor behavior changes:

- Run `npm test`.
- Run `npm run build`.
- Add or update tests for HTML parsing/serialization when changing schema, marks, nodes, commands, or sanitization.
- Browser-check the demo for interaction-heavy changes such as selection, tables, dialogs, drag/drop, paste, image upload, and source mode.

For documentation-only changes, running the full build is usually not required. Review Markdown diffs and keep commands accurate.

## Integration Notes

Moonglade currently stores HTML post content as an HTML string and renders it as raw content. This editor must therefore produce constrained, predictable HTML and should not preserve arbitrary tags, event attributes, unsafe protocols, or unsafe styles.

The host page must load compatible Bootstrap CSS and Bootstrap Icons CSS before using the editor assets. The editor automatically follows the nearest Bootstrap `data-bs-theme` scope through CSS variables; host pages should own theme switching.

Preferred integration models remain:

- Build this project for release, attach generated `dist/moonglade-editor.global.js` and `dist/moonglade-editor.css` artifacts to the GitHub Release, and manually copy those artifacts into Moonglade `wwwroot` when updating the main application.
- Publish this project as an npm package only for release tooling, not for the Moonglade app build.
- Publish a NuGet package with static web assets once the editor API is stable.
- Use a submodule/subtree only if the project later decides to track generated assets again.

Moonglade integration is not completed in this repository.

## AI Task Management Rules

### Complex Task Breakdown

For complex tasks, first split the work into small sub-tasks. Each sub-task should be as much as possible:

- Independently implementable.
- Independently compilable or runnable.
- Independently testable or verifiable.
- Independently committable or revertible.
- Clear about its dependencies on other sub-tasks.

For the following task types, create an independent Markdown task record under `docs/tasks/`:

- Changes across multiple modules or repositories.
- Tasks likely to require multiple conversation turns or context recovery.
- High-risk refactors or migrations.
- Changes involving architecture, data model, public API, build output, deployment, or integration flow.
- Tasks where the user explicitly asks for a retained task record.

Use this naming pattern unless a more specific existing convention applies:

```text
docs/tasks/task-<short-task-name>.md
```

Use `docs/tasks/task-template.md` as the starting structure. Update task records as work progresses so another agent can recover the goal, sequence, verification state, and unresolved issues after interruption or context compaction.

### Documentation Sync

After finishing a development, bug fix, refactor, configuration, dependency, build, or integration change, check whether it affects:

- Project purpose or business flow.
- Run/build/test/deploy commands.
- Technical stack or dependencies.
- Code architecture or module boundaries.
- Environment variables or configuration.
- Development conventions.
- Reusable troubleshooting knowledge.

If it does, update the relevant docs, including but not limited to:

- `README.md`
- `AGENTS.md`
- `docs/`

If it does not, mention in the final response that no documentation update was needed.

### Troubleshooting / Lessons Learned

When an AI assistant encounters an error, successfully fixes it, and the user confirms the result, decide whether the lesson has long-term reuse value.

Record it only when at least one of these is true:

- Future developers or AI assistants are likely to hit it again.
- It is tied to this project's architecture, dependencies, build, integration, or configuration.
- The root cause is not obvious.
- The user explicitly asks to preserve the lesson.

Short entries can be added here. Longer or multiple entries should go in `docs/troubleshooting.md`, with a summary link from this file.

Use this format:

```markdown
## Troubleshooting / Lessons Learned

### Issue title

- Symptom:
- Trigger:
- Root cause:
- Fix:
- Verification:
- Prevention:
```

### Communication Rules

Ask the user instead of guessing when:

- Business meaning cannot be confirmed from code or docs.
- Run, release, or deployment behavior is unclear and the choice affects outcomes.
- Multiple technical interpretations are plausible.
- A command may modify dependencies, generated assets, external services, databases, or production-like state.
- Existing important documentation may be overwritten.
- Suspected secrets or sensitive data are found.
- A repository boundary is unclear.

When asking, list the exact points that need confirmation. After the user answers, update the relevant docs if the answer has lasting value.

## Troubleshooting / Lessons Learned

No durable troubleshooting entries have been confirmed yet.
