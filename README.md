# Moonglade.Editor

Standalone unified editor package for Moonglade.

This repository keeps editor source code, dependencies, tests, and build tooling outside the main Moonglade ASP.NET Core application. Moonglade can consume compiled release assets without introducing a frontend build step into that repository.

## Project Overview

Moonglade.Editor is a focused unified editor for Moonglade admin content. It uses ProseMirror for rich HTML blog post editing and CodeMirror for code-like Markdown, raw HTML, and CSS editing while preserving Moonglade's existing content model.

The main use cases are:

- Editing Moonglade HTML blog post content in rich HTML mode.
- Editing Markdown post content, raw HTML page content, page CSS, and site custom CSS in code-like modes.
- Producing constrained, predictable HTML for Moonglade's raw HTML renderer.
- Uploading and inserting post images through a configurable upload endpoint.
- Shipping browser-ready JavaScript and CSS that Moonglade can reference as static assets.

## Business Logic Overview

The editor flow is intentionally narrow:

1. The host page creates an editor with `createMoongladeEditor(...)`.
2. Initial HTML is read from `content` or an attached `textarea`.
3. HTML is parsed through the ProseMirror schema after unsafe URL attributes are removed or normalized.
4. Users edit content through the ProseMirror `EditorView` and the framework-free toolbar.
5. Commands update the document for headings, marks, links, colors, alignment, lists, blockquotes, horizontal rules, inline code, code blocks, tables, source mode, and images.
6. On rich HTML document changes, the editor serializes the ProseMirror document back to HTML and schedules automatic sync to the attached `textarea` and optional `onChange` callback.

Key concepts:

- `MoongladeEditor` is the public editor wrapper.
- `moongladeSchema` defines the allowed document structure and marks.
- `parseHtml(...)` and `serializeHtml(...)` are the import/export boundary for stored HTML.
- `safety.ts` contains URL, style, alignment, code language, and HTML class attribute constraints.
- Image upload is configured with either `uploadUrl` or a custom `uploadImage` function, with upload file extensions constrained by `allowedImageExtensions`.
- Code snippet languages are configured through `codesample_languages`, with values filtered by the same code language sanitizer used for stored HTML.
- HTML source mode uses an internal CodeMirror 6 HTML editor for syntax highlighting, folding, and find/replace while keeping saved content routed through the same sanitizer-backed HTML boundary.

Supported rich HTML capabilities currently include H1-H6 headings, paragraphs, bold, italic, underline, strikethrough, foreground/background color, tables, images, inline code, code snippets, links, blockquotes, horizontal rules, bullet/numbered lists, text alignment, and HTML source view/edit with code highlighting, folding, and find/replace. Supported code-like modes are `markdown`, `html`, and `css`, with search/replace, folding, syntax highlighting, formatting, textarea synchronization, and Markdown image paste/drop upload.

## Development

Configured commands:

```powershell
npm install
npm test
npm run build
npm run pack:nuget
npm run dev
npm run demo:upload
npm run size
```

These commands are defined in `package.json`.

To run the demo after building:

```powershell
npx http-server . -p 5173
```

Then open `http://localhost:5173/demo/`.

To test the demo image upload flow, run the built-in Node.js test server instead:

```powershell
npm run build
npm run demo:upload
```

Then open `http://localhost:5173/demo/`. The server accepts `POST /image` uploads from the demo editor's `uploadUrl`, stores files under `output/upload-test/`, and returns the `location` field expected by the editor. This server is for local testing only, not production image handling.

The build emits:

- `dist/moonglade-editor.js` - bundled and minified ESM entry.
- `dist/moonglade-editor.global.js` - bundled and minified browser global entry.
- `dist/moonglade-editor.formatter.js` - lazy-loaded Prettier formatter asset for code-like modes.
- `dist/moonglade-editor.css` - minified editor styles.
- `dist/*.d.ts` - TypeScript declarations.

`npm run build` also checks bundle size budgets for the generated JavaScript and CSS files. The current budgets include the internal CodeMirror runtime used by HTML source mode.

`npm run pack:nuget` requires the .NET 10 SDK. It builds the editor, stages only browser assets under `wwwroot/moonglade-editor/`, and creates `artifacts/nuget/Moonglade.Editor.StaticAssets.{version}.nupkg`. The NuGet package version is read from `package.json` `version`, which is the single version source; set `NUGET_OUTPUT` to change the output directory.

GitHub Actions runs tests and the build workflow for pushes to `main` and `release`, and for pull requests targeting those branches.

`dist/` and the NuGet staging files under `wwwroot/moonglade-editor/` are generated locally and ignored by Git so routine source changes do not include bundle churn in code review. For releases, prefer publishing `Moonglade.Editor.StaticAssets` as a NuGet package. GitHub Release assets can still be attached as a manual fallback.

For AI continuation, read:

- `AGENTS.md`
- `docs/ai-review-plan.md`

## Main API

```ts
import { createMoongladeEditor } from '@moonglade/editor';

const editor = createMoongladeEditor({
  mode: 'rich-html',
  element: document.querySelector('#editor')!,
  textarea: document.querySelector('#content')!,
  height: '500px',
  spellcheck: true,
  uploadUrl: '/image',
  allowedImageExtensions: ['.jpg', '.png', '.webp', '.svg'],
  codesample_languages: [
    { text: 'Bash', value: 'bash' },
    { text: 'Bicep', value: 'bicep' },
    { text: 'C#', value: 'csharp' },
    { text: 'JavaScript', value: 'javascript' },
    { text: 'Plain Text', value: 'plaintext' },
    { text: 'TypeScript', value: 'typescript' }
  ]
});

editor.setSpellcheck(false);
editor.syncToTextarea();
```

For Markdown, raw HTML, and CSS code-like modes, pass `mode`:

```ts
const editor = createMoongladeEditor({
  mode: 'markdown',
  element: document.querySelector('#markdown-content-editor')!,
  textarea: document.querySelector('#content')!,
  height: '500px',
  lineWrapping: true,
  tabSize: 2,
  markdownImageUpload: {
    allowedImageExtensions: ['.jpg', '.png', '.webp', '.svg'],
    upload: async (file) => ({
      url: await uploadMarkdownImage(file)
    })
  }
});

editor.getValue();
editor.setValue('# Updated');
await editor.format();
editor.syncToTextarea();
```

`createMoongladeCodeEditor(...)` remains exported as a compatibility factory during migration, but new host code should prefer `createMoongladeEditor({ mode })`.

Content access is immediate through `getHTML()` in rich HTML mode and `getValue()` in code-like modes. Explicit `syncToTextarea()` writes immediately. Automatic `textarea` and `onChange` sync is debounced after document edits.

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

The two upload options use different response shapes:

- `uploadImage(file)` resolves directly to the editor result `{ src, alt?, title? }`, where `src` must be a safe image URL. `alt` and `title` are optional.
- `uploadUrl` posts the file as multipart form-data (field name `file`, `credentials: 'same-origin'`, `Accept: application/json`) and expects a JSON response `{ location, filename?, title? }`. The editor maps `location` to `src`, `filename` to `alt` (falling back to the original file name), and `title` to `title`. A missing or empty `location`, or a non-JSON response, is treated as an upload error.

Image uploads allow `.jpg`, `.png`, `.webp`, and `.svg` by default. Rich HTML hosts can override that list with top-level `allowedImageExtensions`; Markdown hosts can override it with `markdownImageUpload.allowedImageExtensions`. Values are case-insensitive and may include or omit the leading dot. This client-side filter applies to the rich HTML image toolbar dialog, rich HTML paste/drop uploads, and Markdown paste/drop uploads, but upload endpoints should still validate file content server-side. Pasted clipboard images in rich HTML show a temporary local preview while the upload is pending; saved HTML only receives the safe URL returned by the configured uploader.

Code snippet languages use the default built-in dropdown unless hosts pass `codesample_languages`. Each entry uses `{ text, value }`, where `text` is the displayed label and `value` becomes the sanitized code language class suffix, such as `language-bicep`. The Insert code toolbar button wraps selected text as inline `<code>`; with an empty selection it opens the code snippet dialog.

HTML source mode and imported HTML are constrained before entering the editor schema:

- Links allow `http`, `https`, `mailto`, `tel`, and relative/root/fragment URLs.
- Images allow `http`, `https`, and relative/root URLs.
- Text colors allow hex, `rgb(...)`, and `rgba(...)` values.
- Text alignment imports legacy `style`/`align` values and Bootstrap alignment classes, then serializes as Bootstrap classes such as `text-center`.
- Schema-supported elements preserve safe custom `class` tokens, such as `ul class="abc"` and `table class="custom-table"`, while unsupported tags and unsafe class tokens are still dropped.

The source dialog provides HTML syntax highlighting, line numbers, code folding, and find/replace. Applying source edits still re-enters through `setHTML(...)`, so unsupported tags, unsafe URLs, event attributes, and unsafe styles are not preserved just because they were typed in source mode.

Serialized editor output is newline-formatted around block content such as headings, paragraphs, horizontal rules, blockquotes, tables, and standalone image paragraphs so the synced HTML remains practical to hand-edit.

The editor height defaults to `500px`. Hosts can pass any CSS height value through `height`, such as `640px`, `60vh`, or `calc(100vh - 12rem)`. Users can also drag the editor's bottom corner resize handle to adjust the height while editing.

## Consuming From Moonglade

Moonglade should consume prebuilt release files from this repository and should not add a frontend build step.

The editor markup uses Bootstrap 5 utility/control classes and Bootstrap Icons `bi-*` icon classes. The host page must load compatible Bootstrap CSS and Bootstrap Icons CSS before using the editor assets. Custom editor styles inherit Bootstrap CSS variables, so the editor follows the nearest host `data-bs-theme` scope; omit the attribute or set `data-bs-theme="light"` for the default light theme, and set `data-bs-theme="dark"` for dark mode.

Preferred NuGet static web assets option:

```xml
<PackageReference Include="Moonglade.Editor.StaticAssets" Version="0.5.0" />
```

```html
<link rel="stylesheet" href="~/_content/Moonglade.Editor.StaticAssets/moonglade-editor/moonglade-editor.css" asp-append-version="true">
<script src="~/_content/Moonglade.Editor.StaticAssets/moonglade-editor/moonglade-editor.global.js" asp-append-version="true"></script>
```

The lazy formatter asset is packaged beside the main JavaScript at `~/_content/Moonglade.Editor.StaticAssets/moonglade-editor/moonglade-editor.formatter.js`, which matches the editor's default runtime lookup.

Static asset option:

```html
<link rel="stylesheet" href="/lib/bootstrap/css/bootstrap.min.css">
<link rel="stylesheet" href="/lib/bootstrap-icons/font/bootstrap-icons.min.css">
<link rel="stylesheet" href="/lib/moonglade-editor/moonglade-editor.css">
<script src="/lib/moonglade-editor/moonglade-editor.global.js"></script>
<script>
  const editor = MoongladeEditor.createMoongladeEditor({
    mode: 'rich-html',
    element: document.querySelector('#editor'),
    textarea: document.querySelector('#post-content'),
    height: '500px',
    spellcheck: true,
    uploadUrl: '/image',
    allowedImageExtensions: ['.jpg', '.png', '.webp', '.svg'],
    codesample_languages: [
      { text: 'Bash', value: 'bash' },
      { text: 'Bicep', value: 'bicep' },
      { text: 'C#', value: 'csharp' },
      { text: 'JavaScript', value: 'javascript' },
      { text: 'Plain Text', value: 'plaintext' },
      { text: 'TypeScript', value: 'typescript' }
    ]
  });
</script>
```

Copy `moonglade-editor.formatter.js` to the same folder as `moonglade-editor.js`; it is loaded only when code-like mode formatting is used.

Package options that preserve the same contract:

- Publish `Moonglade.Editor.StaticAssets` as a NuGet package with static web assets, then update the `PackageReference` version in Moonglade.
- Build this project for release, attach the generated `dist/moonglade-editor.global.js`, `dist/moonglade-editor.css`, and `dist/moonglade-editor.formatter.js` files to the GitHub Release, and manually copy those artifacts into Moonglade `wwwroot` only as a fallback.
- Publish this project as an npm package only for release tooling, not for the Moonglade app build.
- Use a submodule/subtree only if the project later decides to track generated assets again.

## Repository Status

The schema, parser/serializer, rich editor shell, Bootstrap light/dark theme adaptation, toolbar shell, formatting controls, selection state, link dialog, color controls, text alignment, image upload dialog with paste support, inline code, code snippets, horizontal rule insertion, table controls, CodeMirror-backed code modes, consumption docs, tests, and build pipeline are present.

Moonglade should consume this package through the `Moonglade.Editor.StaticAssets` NuGet package, or through manually copied prebuilt static assets as a fallback. It should continue doing so without adding npm, Vite, webpack, Rollup, or esbuild to the main Moonglade repository.

This is a single-package repository, not a monorepo.

## License

This project is licensed under the MIT License. See the `LICENSE` file for the full text.
