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
- esbuild emits ESM and browser-global bundles to dist/.
- Vitest/jsdom tests cover basic HTML round-trip behavior and unsafe link stripping.
- Demo page exists at demo/index.html and can be served from the repository root after npm run build.

Before implementing, inspect nearby source and update the task file as progress changes.
For behavior changes, run npm test and npm run build.

Recommended next implementation batch:

1. Build the editor toolbar shell with Bootstrap-friendly classes and no framework dependency.
2. Wire heading/paragraph, bold, italic, underline, strikethrough, blockquote, lists, undo, and redo commands.
3. Add toolbar state updates based on the current selection.
4. Update the demo so these controls are visible and manually testable.
5. Add tests for any schema/serialization changes.

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

