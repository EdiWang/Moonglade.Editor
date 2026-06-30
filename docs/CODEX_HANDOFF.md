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
- esbuild emits ESM and browser-global bundles to dist/.
- Vitest/jsdom tests cover basic HTML round-trip behavior, unsafe link stripping, toolbar shell/format wiring, and blockquote toggle state.
- Demo page exists at demo/index.html and can be served from the repository root after npm run build.

Before implementing, inspect nearby source and update the task file as progress changes.
For behavior changes, run npm test and npm run build.

Recommended next implementation batch:

1. Add the link dialog for add/edit/remove link workflows.
2. Add safe link command tests around accepted and rejected protocols.
3. Add foreground/background color controls with constrained palette values.
4. Add serialization tests for color output and sanitizer behavior.
5. Browser-check the demo for toolbar, dialog focus, selection preservation, and textarea sync.

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

