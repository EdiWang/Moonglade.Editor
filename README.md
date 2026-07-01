# Moonglade.Editor

Standalone ProseMirror-based rich text editor for Moonglade.

This repository keeps editor source code, dependencies, tests, and build tooling outside the main Moonglade ASP.NET Core application. Moonglade can consume the compiled `dist/` assets without introducing a frontend build step into that repository.

## Project Overview

Moonglade.Editor is a focused HTML editor for Moonglade blog posts. It replaces the need for a large third-party hosted editor in the HTML post workflow while preserving Moonglade's existing content model: posts are stored as HTML strings and rendered by the main application.

The main use cases are:

- Editing Moonglade HTML blog post content.
- Producing constrained, predictable HTML for Moonglade's raw HTML renderer.
- Uploading and inserting post images through a configurable upload endpoint.
- Shipping browser-ready JavaScript and CSS that Moonglade can reference as static assets.

## Business Logic Overview

The editor flow is intentionally narrow:

1. The host page creates an editor with `createMoongladeEditor(...)`.
2. Initial HTML is read from `content` or an attached `textarea`.
3. HTML is parsed through the ProseMirror schema after unsafe URL attributes are removed or normalized.
4. Users edit content through the ProseMirror `EditorView` and the framework-free toolbar.
5. Commands update the document for headings, marks, links, colors, alignment, lists, blockquotes, horizontal rules, code blocks, tables, source mode, and images.
6. On document changes, the editor serializes the ProseMirror document back to HTML and syncs it to the attached `textarea` and optional `onChange` callback.

Key concepts:

- `MoongladeEditor` is the public editor wrapper.
- `moongladeSchema` defines the allowed document structure and marks.
- `parseHtml(...)` and `serializeHtml(...)` are the import/export boundary for stored HTML.
- `safety.ts` contains URL, style, alignment, and code language constraints.
- Image upload is configured with either `uploadUrl` or a custom `uploadImage` function.

Supported editing capabilities currently include H1-H6 headings, paragraphs, bold, italic, underline, strikethrough, foreground/background color, tables, images, code snippets, links, blockquotes, horizontal rules, bullet/numbered lists, text alignment, and HTML source view/edit.

## Development

Configured commands:

```powershell
npm install
npm test
npm run build
npm run dev
npm run size
```

These commands are defined in `package.json`. They were not re-run during this documentation-only update.

To run the demo after building:

```powershell
npx http-server . -p 5173
```

Then open `http://localhost:5173/demo/`.

The build emits:

- `dist/moonglade-editor.js` - bundled ESM entry.
- `dist/moonglade-editor.global.js` - bundled browser global entry.
- `dist/moonglade-editor.css` - editor styles.
- `dist/*.d.ts` - TypeScript declarations.

`npm run build` also checks bundle size budgets for the generated JavaScript and CSS files.

For Codex continuation, read:

- `AGENTS.md`
- `docs/CODEX_HANDOFF.md`
- `docs/tasks/task-moonglade-editor-implementation.md`

## Main API

```ts
import { createMoongladeEditor } from '@moonglade/editor';

const editor = createMoongladeEditor({
  element: document.querySelector('#editor')!,
  textarea: document.querySelector('#content')!,
  height: '500px',
  spellcheck: true,
  uploadUrl: '/image'
});

editor.setSpellcheck(false);
editor.syncToTextarea();
```

For custom image upload flows, pass `uploadImage` instead of `uploadUrl`:

```ts
const editor = createMoongladeEditor({
  element: document.querySelector('#editor')!,
  uploadImage: async (file) => {
    const result = await uploadPostImage(file);
    return {
      src: result.url,
      alt: result.altText
    };
  }
});
```

HTML source mode and imported HTML are constrained before entering the editor schema:

- Links allow `http`, `https`, `mailto`, `tel`, and relative/root/fragment URLs.
- Images allow `http`, `https`, and relative/root URLs.
- Text colors allow hex, `rgb(...)`, and `rgba(...)` values.

The editor height defaults to `500px`. Hosts can pass any CSS height value through `height`, such as `640px`, `60vh`, or `calc(100vh - 12rem)`.

## Consuming From Moonglade

Moonglade should consume prebuilt files from this repository and should not add a frontend build step.

The editor markup uses Bootstrap 5 utility/control classes and Bootstrap Icons `bi-*` icon classes. The host page must load compatible Bootstrap CSS and Bootstrap Icons CSS before using the editor assets.

Static asset option:

```html
<link rel="stylesheet" href="/lib/bootstrap/css/bootstrap.min.css">
<link rel="stylesheet" href="/lib/bootstrap-icons/font/bootstrap-icons.min.css">
<link rel="stylesheet" href="/lib/moonglade-editor/moonglade-editor.css">
<script src="/lib/moonglade-editor/moonglade-editor.global.js"></script>
<script>
  const editor = MoongladeEditor.createMoongladeEditor({
    element: document.querySelector('#editor'),
    textarea: document.querySelector('#post-content'),
    height: '500px',
    spellcheck: true,
    uploadUrl: '/image'
  });
</script>
```

Package options that preserve the same contract:

- Copy `dist/moonglade-editor.global.js` and `dist/moonglade-editor.css` into Moonglade `wwwroot` during release packaging.
- Publish this project as an npm package only for release tooling, not for the Moonglade app build.
- Publish a NuGet package with static web assets once the editor API is stable.
- Use a submodule/subtree only if checked-in `dist` files remain the integration boundary.

## Repository Status

The schema, parser/serializer, editor shell, toolbar shell, formatting controls, selection state, link dialog, color controls, text alignment, image upload UI, code snippets, horizontal rule insertion, table controls, source mode, consumption docs, tests, and build pipeline are present.

Moonglade integration is planned follow-up work and should happen without adding npm, Vite, webpack, Rollup, or esbuild to the main Moonglade repository.

This is a single-package repository, not a monorepo.

## License

This package is private and currently marked `UNLICENSED`. Choose the intended license before publishing the package or distributing it independently.
