# Codex Handoff Prompt

Use this prompt when starting a new Codex conversation in `E:\GitHub\ediwang\Moonglade.Editor`.

```text
You are working in E:\GitHub\ediwang\Moonglade.Editor.

Read AGENTS.md first, then read:

- docs/tasks/task-moonglade-editor-implementation.md
- README.md

Context:

- This repository is a standalone ProseMirror editor package for Moonglade.
- The main Moonglade repository must not gain a frontend build pipeline.
- Build tooling belongs here, not in Moonglade.
- Moonglade will consume prebuilt artifacts from this repo's dist/ folder or from a package artifact.
- The editor stores and returns HTML strings, not ProseMirror JSON.
- Keep the public API centered on createMoongladeEditor(options).
- Preserve compatibility with Moonglade's /image upload endpoint and raw HTML post renderer.

Current scaffold:

- TypeScript source under src/.
- ProseMirror schema, HTML parse/serialize helpers, commands, and basic EditorView wrapper exist.
- Framework-free toolbar shell, basic formatting controls, undo/redo, and selection state exist.
- Link dialog, safe command URL validation, foreground/background color palette controls, text alignment controls, image upload controls, code snippet controls, horizontal rule insertion, table controls, and HTML source mode exist.
- Editor height is configurable through `createMoongladeEditor({ height })`, defaults to `500px`, and accepts CSS height strings.
- esbuild emits ESM and browser-global bundles to dist/.
- Vitest/jsdom tests cover basic HTML round-trip behavior, unsafe link/image stripping, toolbar shell/format wiring, blockquote toggle state, link dialog/command safety, color controls, alignment controls, mocked image upload responses, code snippets, horizontal rule insertion, table controls, and source mode.
- Demo page exists at demo/index.html and can be served from the repository root after npm run build.

Before implementing, inspect nearby source and update the task file as progress changes.
For behavior changes, run npm test and npm run build.

Recommended next implementation batch:

1. Integrate the built editor assets into the main Moonglade repository without adding frontend build tooling there.
2. Preserve Markdown editor behavior and the existing post save payload shape.
3. Browser-check HTML post editing, `/image` upload, source mode, table editing, and save/preview rendering in Moonglade.
4. Choose a publishing license before distributing the package independently.

Do not remove, bypass, or weaken the sanitizer and schema constraints.
Do not introduce React/Vue/Angular/Svelte unless explicitly requested.
```

## Quick Commands

```powershell
cd E:\GitHub\ediwang\Moonglade.Editor
npm install
npm test
npm run build
npx http-server . -p 5173
```

Open:

```text
http://localhost:5173/demo/
```

