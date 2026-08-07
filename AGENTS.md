# AGENTS.md

This file is for AI agents and engineers working in this repository. Read it before changing code, then inspect nearby implementation and tests to confirm the current local pattern.

## Project Purpose

Moonglade.Editor is a standalone, first-party unified editor package for Moonglade. It exists so the main Moonglade ASP.NET Core repository can consume prebuilt static editor assets without adding a frontend build pipeline to that application.

The package exposes one mode-based entry point while keeping two internal engines: ProseMirror for rich HTML post editing, and CodeMirror for code-like Markdown, raw HTML, and CSS editing. The rich HTML mode should stay focused on Moonglade's blog post editing needs:

- Headings H1-H6 and paragraphs.
- Bold, italic, underline, strikethrough.
- Text foreground and background color.
- Tables.
- Image upload and insertion.
- Inline code and code snippets.
- Links.
- Blockquotes.
- Horizontal rules.
- Bullet and numbered lists.
- Text alignment.
- HTML source view/edit.
- Markdown post content.
- Raw HTML page content.
- Page-level CSS and site-level custom CSS.

Do not add broad word-processor features unless explicitly requested. In particular, do not add Word/Office paste cleanup, emoji insertion, special-symbol insertion, line-height controls, paragraph-spacing controls, collaboration, or a media library by default.

## Repository Contract

- Source code lives under `src/`.
- Browser-ready output is generated under `dist/` by the build.
- NuGet static web asset packages are generated under `artifacts/nuget/` by `npm run pack:nuget`.
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
- .NET SDK version: .NET 10 SDK is required for `npm run pack:nuget`. No `global.json` is currently defined.
- JavaScript target: ES2020 in `tsconfig.json` and `scripts/build.mjs`.
- Runtime environment: Browser DOM through ProseMirror `EditorView` and CodeMirror 6 `EditorView`.
- Node.js version: To be confirmed. No `engines` field is currently defined.
- Package manager: npm, with `package-lock.json` committed.
- Rich HTML editor framework: ProseMirror core packages (`prosemirror-model`, `prosemirror-state`, `prosemirror-view`, commands, history, keymap, schema-list, tables, gapcursor).
- Code editor framework: CodeMirror 6 packages for HTML source mode plus public Markdown, raw HTML, and CSS modes (`@codemirror/lang-markdown`, `@codemirror/lang-html`, `@codemirror/lang-css`, autocomplete, language folding/highlighting, search, state, view, and commands).
- UI framework: No SPA framework. Toolbar/dialogs are built with DOM APIs and Bootstrap-compatible classes.
- Host UI dependencies: Bootstrap 5 CSS and Bootstrap Icons CSS are expected to be loaded by the consuming host page.
- Theme behavior: Custom editor styles use Bootstrap CSS variables and should inherit the nearest host `data-bs-theme` scope. Keep theme switching host-owned; do not add editor-specific theme APIs unless explicitly requested.
- Build tooling: esbuild via `scripts/build.mjs`; TypeScript declarations via `tsc -p tsconfig.build.json`.
- Runtime formatting: Prettier standalone for Markdown, HTML, and CSS, lazy-loaded through `moonglade-editor.formatter.js`.
- Testing: Vitest with jsdom.
- Type checking: `npm run types`.
- Bundle size checking: `scripts/check-size.mjs`, run by `npm run build`.
- Formatting: To be confirmed. No formatter script is currently configured.
- Linting: To be confirmed. No lint script is currently configured.
- Database/cache/message queue: None.
- Deployment/runtime service infrastructure: None in this package. The intended integration boundary is prebuilt static assets or a package artifact consumed by Moonglade.
- License: MIT in `package.json`, with the full text in the repository `LICENSE` file.

## Code Architecture

Important directories:

- `src/` - TypeScript source for the editor package.
- `test/` - Vitest/jsdom unit tests for parsing, sanitization, commands, toolbar wiring, upload handling, and source mode.
- `scripts/` - Build and bundle size scripts.
- `dist/` - Ignored generated browser-ready JavaScript, CSS, source maps, and declaration files.
- `wwwroot/moonglade-editor/` - Ignored NuGet static web asset staging folder populated from `dist/` by `npm run pack:nuget`.
- `artifacts/nuget/` - Ignored generated NuGet package output.
- `demo/` - Static demo page for manual browser checks.
- `docs/` - Long-lived handoff, task, and project documentation.

Key source modules:

- `src/index.ts` is the public package export surface and mode-based factory.
- `src/editor.ts` owns `MoongladeEditor`, `createMoongladeEditor(...)`, `EditorView` setup, plugins, toolbar wiring, textarea sync, source updates, and image paste/drop/upload integration.
- `src/code-editor.ts` owns `MoongladeCodeEditor`, CodeMirror setup, the built-in code toolbar, textarea sync, language switching, read-only mode, line wrapping, and status UX.
- `src/code-languages.ts` maps supported code-like modes to CodeMirror language extensions. Keep this list intentionally limited to Markdown, HTML, and CSS unless Moonglade gains a confirmed business need.
- `src/code-formatter.ts` and `src/code-formatter-runtime.ts` own the lazy Prettier formatting boundary for Markdown, HTML, and CSS.
- `src/markdown-image-upload.ts` owns Markdown-only image paste/drop upload handling.
- `src/schema.ts` defines the ProseMirror schema, including alignment-aware paragraphs/headings that serialize Bootstrap text alignment classes, code block language attributes, table nodes, underline/strike marks, and constrained color marks.
- `src/html.ts` is the HTML import/export boundary. It removes unsafe URL/event attributes before schema parsing, adds lazy loading to serialized images, and newline-formats block-oriented output for source editing.
- `src/safety.ts` contains reusable sanitizers for links, image URLs, style color values, text alignment, code language names, and HTML class attributes.
- `src/commands.ts` defines editor commands for block formats, marks, links, colors, alignment, images, inline code, code blocks, lists, blockquotes, horizontal rules, history, and tables.
- `src/editor-state.ts` contains helpers for command availability and toolbar active-state detection.
- `src/toolbar.ts` assembles the framework-free toolbar and preserves the narrow toolbar export surface used by `src/editor.ts`.
- `src/toolbar/` contains toolbar contracts, shared DOM helpers, and focused tool modules for history, block format selection, inline marks, colors, blocks/lists, alignment, insertion, tables, source mode, dialogs, and upload status. Add new toolbar tools by creating or extending a focused tool module and registering it from `src/toolbar.ts`.
- `src/dialogs.ts` creates link, code snippet, image upload, and HTML source dialog shells. The HTML source dialog lazy-loads its CodeMirror-backed editor on first use.
- `src/source-code-editor.ts` contains the internal CodeMirror-backed HTML source editor used by the rich HTML source dialog after it is loaded, including syntax highlighting, line numbers, folding, and find/replace.
- `src/editor-options.ts` contains supported block formats, color palette values, and code language options.
- `src/image-upload.ts` contains upload URL and custom uploader integration.
- `src/styles.css` contains rich HTML editor styles, and `src/code-styles.css` contains code editor styles. The build combines both into `dist/moonglade-editor.css`.

Core flow:

1. `createMoongladeEditor(options)` constructs a rich HTML editor by default, or a code editor when `mode` is `markdown`, `html`, or `css`.
2. Initial content comes from `options.content`, `options.textarea.value`, or an empty string.
3. `parseHtml(schema, html)` sanitizes incoming HTML attributes and parses content into the ProseMirror schema.
4. `EditorView` applies commands and transactions.
5. `dispatchTransaction` serializes changed docs with `serializeHtml(...)`, syncs the textarea, and calls `onChange`.
6. HTML source mode edits are made in the internal CodeMirror source editor, then re-enter through `setHTML(...)` and `parseHtml(...)`, preserving schema and sanitizer constraints.

## Public API Contract

Keep the main API centered on:

```ts
const editor = createMoongladeEditor({
  mode: 'rich-html',
  element,
  textarea,
  height: '500px',
  uploadUrl: '/image',
  allowedImageExtensions: ['.jpg', '.png', '.webp', '.svg'],
  codesample_languages: [
    { text: 'Bash', value: 'bash' },
    { text: 'TypeScript', value: 'typescript' }
  ],
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

For code-like modes:

```ts
const editor = createMoongladeEditor({
  mode: 'markdown',
  element,
  textarea,
  height: '500px',
  lineWrapping: true,
  tabSize: 2,
  markdownImageUpload: {
    upload: async (file) => ({ url: await uploadMarkdownImage(file) })
  },
  onChange
});

editor.getValue();
editor.setValue('# Updated');
await editor.format();
editor.syncToTextarea();
editor.focus();
editor.destroy();
```

The compatibility `createMoongladeCodeEditor(...)` export remains available during migration. New Moonglade integration code should use `createMoongladeEditor({ mode })`.

`uploadImage` can replace `uploadUrl` for custom upload behavior. Uploaded images must return a safe URL through `{ src, alt?, title? }`.
`allowedImageExtensions` constrains the client-side upload file picker, paste, and drag/drop flows. It defaults to `.jpg`, `.png`, `.webp`, and `.svg`; hosts can override it with case-insensitive extension strings with or without the leading dot. Server-side upload handlers must still validate file content and extension.
`codesample_languages` configures the code snippet dialog language dropdown with `{ text, value }` entries. Values are normalized through the code language sanitizer before rendering and do not relax imported HTML safety rules.

`height` defaults to `500px` and should accept ordinary CSS height values such as `px`, `vh`, and `calc(...)` strings.

Do not require Moonglade to understand ProseMirror JSON as the storage format unless the main project explicitly decides to change its content model.

## Development Rules

- Preserve the goal that Moonglade itself does not need npm, Vite, webpack, Rollup, or esbuild to run.
- Prefer explicit schema definitions and commands over large editor frameworks.
- Keep CodeMirror usage scoped to HTML source mode and the public Markdown, raw HTML, and CSS code-like modes.
- Keep ProseMirror schema output compatible with Moonglade's existing public post renderer.
- Treat HTML source mode and pasted/imported HTML as untrusted input that must pass through the schema and sanitizer.
- Preserve safe URL handling for links and images. Reject script-like protocols.
- Keep image upload integration configurable through options; Moonglade will pass `/image`.
- Keep image upload extension filtering configurable through `allowedImageExtensions`; default to `.jpg`, `.png`, `.webp`, and `.svg`.
- Keep dependency licenses permissive and documented. Verify license changes before adding new dependencies.
- Commit `package-lock.json` whenever dependencies change.
- Do not edit generated `dist/` files by hand; update source or build scripts and rebuild for verification or release packaging.
- Avoid unrelated formatting churn.
- Keep code comments and developer-facing strings in English unless an existing localized resource explicitly requires another language.
- Use structured DOM/schema APIs where possible instead of ad hoc string manipulation.

## Configuration and Environment

Project-specific environment variables:

- `PORT` - Optional port for the local Node.js upload test server used by `npm run demo:upload`. Example: `5173`.
- `NUGET_OUTPUT` - Optional NuGet package output directory for `npm run pack:nuget`. Defaults to `artifacts/nuget`. Example: `artifacts/nuget-preview`.

Configuration files:

- `package.json` - package metadata, dependencies, npm scripts, export map.
- `package-lock.json` - npm dependency lockfile.
- `tsconfig.json` - shared TypeScript compiler settings for source, tests, scripts, and Vitest config.
- `tsconfig.build.json` - declaration-only TypeScript build output to `dist/`.
- `vitest.config.ts` - Vitest configuration using the `jsdom` environment.
- `.github/workflows/build.yml` - CI workflow for tests/builds on `main` and `release`, plus NuGet publishing on release branch pushes.
- `scripts/build.mjs` - esbuild ESM/global bundles, split ESM entries (`moonglade-editor.js`, `moonglade-editor.rich-html.js`, `moonglade-editor.code.js`), shared chunks, lazy formatter bundle, and CSS output; release builds are minified while `--watch` keeps readable output.
- `scripts/check-size.mjs` - size budgets for generated JavaScript entries, chunks, formatter JavaScript, and CSS artifacts.
- `scripts/pack-nuget.mjs` - builds `dist/`, recursively stages browser assets including `chunks/` under `wwwroot/moonglade-editor/`, and runs `dotnet pack` for `Moonglade.Editor.StaticAssets`.
- `Moonglade.Editor.StaticAssets.csproj` - Razor SDK package project that turns staged browser assets into ASP.NET Core static web assets.
- `scripts/upload-test-server.mjs` - local Node.js static demo server and `POST /image` upload test endpoint.

If environment variables are added later, document each name, purpose, whether it is required, and an example format. Do not document real secrets.

GitHub Actions secrets:

- `NUGET_API_KEY` - Required only for `release` branch NuGet publishing. Store a NuGet API key with permission to push `Moonglade.Editor.StaticAssets`.

## Common Commands

```powershell
npm install
npm run build
npm run pack:nuget
npm test
npm run dev
npm run demo:upload
npm run size
```

Command meanings:

- `npm install` installs dependencies from `package-lock.json`.
- `npm test` runs Vitest in jsdom.
- `npm run types` emits declaration files only.
- `npm run bundle` runs esbuild and writes minified JS/CSS release assets, including the lazy formatter asset.
- `npm run size` checks configured bundle size budgets.
- `npm run build` cleans `dist/`, emits declarations, bundles assets, and checks size budgets.
- `npm run pack:nuget` builds the editor and creates `artifacts/nuget/Moonglade.Editor.StaticAssets.{version}.nupkg`, using `package.json` `version` as the single version source.
- `npm run dev` watches source files and rebuilds bundles/styles.
- `npm run demo:upload` serves the built demo and a local `POST /image` endpoint for testing image uploads.

## Verification

For editor behavior changes:

- Run `npm test`.
- Run `npm run build`.
- Add or update tests for HTML parsing/serialization when changing schema, marks, nodes, commands, or sanitization.
- Add or update tests for public code mode behavior when changing editor lifecycle, language switching, formatting, upload insertion, or textarea sync.
- Browser-check the demo for interaction-heavy changes such as selection, tables, dialogs, drag/drop, paste, image upload, and source mode.

For documentation-only changes, running the full build is usually not required. Review Markdown diffs and keep commands accurate.

## Integration Notes

Moonglade currently stores HTML post content as an HTML string and renders it as raw content. Rich HTML mode must therefore produce constrained, predictable HTML and should not preserve arbitrary tags, event attributes, unsafe protocols, or unsafe styles. Code-like raw HTML mode is for page source editing and must preserve the text buffer instead of routing content through the rich HTML schema.

The host page must load compatible Bootstrap CSS and Bootstrap Icons CSS before using the editor assets. The editor automatically follows the nearest Bootstrap `data-bs-theme` scope through CSS variables; host pages should own theme switching.

Preferred integration models remain:

- Publish `Moonglade.Editor.StaticAssets` as a NuGet package with static web assets, then update the `PackageReference` version in Moonglade.
- Build this project for release, attach generated `dist/moonglade-editor.js`, `dist/moonglade-editor.css`, and `dist/moonglade-editor.formatter.js` artifacts to the GitHub Release, and manually copy those artifacts into Moonglade `wwwroot` only as a fallback.
- Publish this project as an npm package only for release tooling, not for the Moonglade app build.
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
