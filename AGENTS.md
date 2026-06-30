# AGENTS.md

This file is for AI agents working in this repository. Read it before changing code, then inspect nearby implementation and tests to confirm the current local pattern.

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
- Bullet and numbered lists.
- Text alignment.
- HTML source view/edit.

Do not add broad word-processor features unless explicitly requested. In particular, do not add Word/Office paste cleanup, emoji insertion, special-symbol insertion, line-height controls, paragraph-spacing controls, collaboration, or a media library by default.

## Repository Contract

- Source code lives under `src/`.
- Browser-ready output lives under `dist/`.
- Tests live under `test/`.
- Demo files live under `demo/`.
- The main Moonglade repository should be able to use `dist/` artifacts directly.
- Keep the public API small and stable; prefer `createMoongladeEditor(...)` plus a narrow editor instance API.
- Keep generated output deterministic and suitable for committing or publishing.

## Technology Stack

- TypeScript.
- ProseMirror core packages.
- esbuild for bundling.
- Vitest with jsdom for unit tests.
- No React, Vue, Angular, Svelte, or SPA framework unless explicitly requested.

## Common Commands

```powershell
npm install
npm run build
npm test
npm run dev
```

## Development Rules

- Preserve the goal that Moonglade itself does not need npm, Vite, webpack, Rollup, or esbuild to run.
- Prefer explicit schema definitions and commands over large editor frameworks.
- Keep ProseMirror schema output compatible with Moonglade's existing public post renderer.
- Treat HTML source mode and pasted/imported HTML as untrusted input that must pass through the schema and sanitizer.
- Preserve safe URL handling for links and images. Reject script-like protocols.
- Keep image upload integration configurable through options; Moonglade will pass `/image`.
- Keep dependency licenses permissive and documented. Verify license changes before adding new dependencies.
- Commit `package-lock.json` whenever dependencies change.
- Do not remove or rewrite generated files by hand; update the build script or source and rebuild.
- Avoid unrelated formatting churn.

## Verification

For editor behavior changes:

- Run `npm test`.
- Run `npm run build`.
- Add or update tests for HTML parsing/serialization when changing schema, marks, nodes, or sanitization.
- Browser-check the demo for interaction-heavy changes such as selection, tables, dialogs, drag/drop, paste, and source mode.

## Integration Notes

Moonglade currently stores HTML post content as an HTML string and renders it as raw content. This editor must therefore produce constrained, predictable HTML and should not preserve arbitrary tags, event attributes, or unsafe styles.

Do not require Moonglade to understand ProseMirror JSON as the storage format unless the main project explicitly decides to change its content model.
