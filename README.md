# Moonglade.Editor

Standalone ProseMirror-based rich text editor for Moonglade.

This repository keeps editor source code, dependencies, tests, and build tooling outside the main Moonglade ASP.NET Core application. Moonglade can consume the compiled `dist/` assets without introducing a frontend build step into that repository.

## Goals

- Build a focused HTML editor for Moonglade blog posts.
- Use ProseMirror directly.
- Ship browser-ready JavaScript and CSS.
- Keep Moonglade's storage model as HTML strings.
- Avoid TinyMCE licensing and payload concerns.

## Development

```powershell
npm install
npm test
npm run build
```

For Codex continuation, read:

- `AGENTS.md`
- `docs/CODEX_HANDOFF.md`
- `docs/tasks/task-moonglade-editor-implementation.md`

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

## Main API

```ts
import { createMoongladeEditor } from '@moonglade/editor';

const editor = createMoongladeEditor({
  element: document.querySelector('#editor')!,
  textarea: document.querySelector('#content')!,
  uploadUrl: '/image'
});

editor.syncToTextarea();
```

## Status

Initial scaffold. The schema, parser/serializer, editor shell, toolbar shell, basic formatting controls, selection state, link dialog, color controls, and build pipeline are present. Image upload UI, alignment, table controls, code snippet UX, source mode, and Moonglade integration are planned follow-up work.

## License

This scaffold is private and currently marked `UNLICENSED`. Choose the intended license before publishing the package or distributing it independently.
