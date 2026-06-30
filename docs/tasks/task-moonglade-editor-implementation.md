# Moonglade.Editor Implementation Task

## Original Goal

Build a standalone, first-party ProseMirror-based HTML editor for Moonglade so the main Moonglade ASP.NET Core repository can replace TinyMCE without adding frontend build tooling to that repository.

## Background

Moonglade currently uses TinyMCE for post `html` content and Monaco for `markdown` content. The user wants to replace TinyMCE because it is heavy and has license concerns. The editor should be developed in this separate repository, `Moonglade.Editor`, and Moonglade should consume prebuilt `dist/` assets or a package artifact.

Key Moonglade integration facts from the originating conversation:

- Main repository path: `E:\GitHub\ediwang\Moonglade`.
- Editor repository path: `E:\GitHub\ediwang\Moonglade.Editor`.
- Moonglade stores post content as HTML strings for `contentType === "html"`.
- Moonglade renders HTML posts as raw content, so editor output must be constrained and predictable.
- Moonglade's image upload endpoint is `/image` and returns `{ location, filename }`.
- Moonglade should not need npm/esbuild/Vite/webpack/Rollup to run or build.
- The first integration should preserve Markdown editor behavior and the existing post save payload shape.

Current repository state:

- `AGENTS.md` contains development rules.
- `package.json` uses TypeScript, ProseMirror, esbuild, Vitest, and jsdom.
- `src/schema.ts` defines the initial ProseMirror schema and custom marks.
- `src/html.ts` contains HTML parsing, serialization, and unsafe attribute stripping.
- `src/commands.ts` contains initial command helpers.
- `src/editor.ts` contains the first `MoongladeEditor` wrapper around `EditorView`.
- `src/styles.css` contains basic editor styles.
- `demo/index.html` loads `dist/moonglade-editor.js`.
- `test/html.test.ts` covers initial HTML round-trip and unsafe link behavior.
- `dist/` contains generated ESM, browser-global, CSS, sourcemap, and type declaration output.
- Remote origin is `https://github.com/EdiWang/Moonglade.Editor.git`.

## Scope

Implement the editor features Moonglade needs:

- H1-H6 headings and paragraphs.
- Bold, italic, underline, strikethrough.
- Foreground color and background color.
- Insert and edit tables.
- Upload and insert images.
- Insert code snippets.
- Edit hyperlinks.
- Blockquote.
- Bullet and numbered lists.
- Text alignment.
- HTML source view/edit.

Also provide:

- A stable public API for Moonglade integration.
- Browser-ready `dist` output.
- Demo coverage for manual testing.
- Automated tests for parser, serializer, schema, sanitizer, and command behavior where practical.
- Documentation for consuming the editor from Moonglade.

## Out of Scope

Do not add these unless explicitly requested:

- React, Vue, Angular, Svelte, or another frontend framework.
- Word/Office paste cleanup.
- Emoji insertion.
- Special symbol insertion.
- Line-height controls.
- Paragraph-spacing controls.
- Collaborative editing.
- Media library or asset browser.
- Changing Moonglade to store ProseMirror JSON.

## Architecture Contract

The public API should stay small:

```ts
const editor = createMoongladeEditor({
  element,
  textarea,
  uploadUrl: '/image',
  content,
  onChange
});

editor.getHTML();
editor.setHTML(html);
editor.syncToTextarea();
editor.focus();
editor.destroy();
```

The editor should:

- parse imported HTML through the ProseMirror schema;
- serialize content back to an HTML string;
- strip unsupported tags/attributes during import;
- reject unsafe link/image protocols;
- set `loading="lazy"` on images by default;
- keep image upload URL configurable;
- avoid depending on Moonglade's runtime globals;
- avoid requiring a frontend build in the Moonglade repository.

## Feature Breakdown

| No. | Feature | Implementation Notes | Verification | Status |
| --- | --- | --- | --- | --- |
| 1 | Repository scaffold | TypeScript, ProseMirror, esbuild, Vitest, demo, AGENTS.md, README, dist output | `npm test`, `npm run build` | Complete |
| 2 | Schema baseline | Paragraph, headings, blockquote, lists, tables, code block, image, custom marks | HTML round-trip tests | Started |
| 3 | HTML safety baseline | Strip event attributes and unsafe protocols | Tests for unsafe links and imported HTML | Started |
| 4 | Editor wrapper | `createMoongladeEditor`, `getHTML`, `setHTML`, `syncToTextarea`, `destroy` | Unit tests and demo smoke check | Started |
| 5 | Toolbar shell | Framework-free toolbar with accessible buttons/selects | Demo manual check | Complete |
| 6 | Basic formatting controls | paragraph/headings, bold, italic, underline, strike, blockquote, bullet/numbered lists, undo/redo | Demo manual check, command tests where useful | Complete |
| 7 | Selection state | Reflect active marks/nodes in toolbar state | Demo manual check | Complete |
| 8 | Link dialog | Add/edit/remove links, safe URL validation | Tests for safe/unsafe URLs | Not started |
| 9 | Color controls | Foreground/background palette and optional custom color input | Serialization tests | Not started |
| 10 | Alignment controls | Left/center/right/justify for supported block nodes | Serialization tests | Not started |
| 11 | Image upload | Button upload, paste, drag/drop, `/image` response handling | Mocked upload tests and demo check | Not started |
| 12 | Code snippets | Language selector and highlight.js-compatible output | Serialization tests and Moonglade renderer check later | Not started |
| 13 | Tables | Insert table, add/delete rows/columns, header toggle, merge/split if feasible | Demo manual check and command tests | Not started |
| 14 | HTML source mode | Source view/edit through schema/sanitizer | Round-trip and unsafe HTML tests | Not started |
| 15 | Moonglade consumption docs | Explain static asset/package options | README/docs update | Not started |
| 16 | Moonglade integration | Happens in the main Moonglade repo after editor package is ready | Moonglade build and browser smoke test | Not started |

## Suggested Execution Order

1. Link and color controls.
2. Alignment support.
3. Image upload support.
4. Code snippet UX.
5. Table controls.
6. HTML source mode.
7. Package/asset consumption documentation.
8. Integrate into Moonglade in a separate task.

## Verification Log

| Date | Command or Check | Result | Notes |
| --- | --- | --- | --- |
| 2026-06-30 | `npm install` | Passed | Generated `package-lock.json`; npm audit reported 0 vulnerabilities. |
| 2026-06-30 | `npm test` | Passed | 3 Vitest/jsdom tests. |
| 2026-06-30 | `npm run build` | Passed | Generated ESM, browser-global, CSS, maps, and declarations under `dist/`. |
| 2026-06-30 | `git remote -v` | Passed | `origin` is `https://github.com/EdiWang/Moonglade.Editor.git`. |
| 2026-06-30 | `npm test` | Passed | 7 Vitest/jsdom tests covering HTML, toolbar shell, format wiring, and blockquote toggle state. |
| 2026-06-30 | `npx tsc --noEmit` | Passed | Full typecheck after toolbar changes. |
| 2026-06-30 | `npm run build` | Passed | Regenerated `dist/` JS, CSS, maps, and declarations. |
| 2026-06-30 | Browser demo smoke check | Passed | Served `demo/`, verified toolbar state, heading command, textarea sync, and undo with Playwright CLI. |

## Known Risks

- Table editing is the most complex requested feature.
- HTML source mode can bypass toolbar constraints unless imported source always goes through schema parsing and sanitization.
- Browser selection behavior needs real browser testing, not only jsdom tests.
- Existing TinyMCE-authored HTML in Moonglade may contain unsupported tags/styles; the editor should degrade gracefully on import.
- The package is currently marked `UNLICENSED`; choose a publishing license before distributing publicly.

## Resume Checklist

Before starting a new batch:

- Read `AGENTS.md`.
- Read this file.
- Run `npm test`.
- Run `npm run build`.
- Serve `demo/` and inspect the current behavior if changing UI/selection interactions.
- Update this file as task statuses change.

## Notes for Moonglade Integration Later

Potential consumption models:

- Copy `dist/moonglade-editor.js`, `dist/moonglade-editor.global.js`, and `dist/moonglade-editor.css` into Moonglade `wwwroot`.
- Publish an npm package and copy files during release tooling, not during Moonglade build.
- Publish a NuGet package with static web assets.
- Use git submodule/subtree and reference checked-in `dist` files.

The preferred model is not finalized. Preserve all options until the editor API stabilizes.

