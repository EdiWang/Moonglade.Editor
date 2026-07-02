# Configurable Code Sample Languages

## Original Goal

Allow hosts to configure the code snippet language dropdown during editor initialization with a JavaScript array such as `codesample_languages: [{ text: 'Bash', value: 'bash' }]`.

## Background

The code snippet dialog previously used a fixed language list from `src/editor-options.ts`. Code block language values are still constrained by `sanitizeCodeLanguage(...)` and stored as highlight.js-compatible `language-*` classes.

## Scope

- Add a public editor option for code sample language choices.
- Preserve the existing default language list when no option is provided.
- Filter unsafe or empty configured entries before rendering the dialog.
- Update tests and public API documentation.

## Out of Scope

- Changing stored HTML semantics for code blocks.
- Adding syntax highlighting or a broader code editor.
- Relaxing sanitizer rules for imported HTML or command language values.

## Task Breakdown

| No. | Task | Dependencies | Verification | Status |
| --- | --- | --- | --- | --- |
| 1 | Add option type and normalization | None | Type check and unit coverage | Complete |
| 2 | Pass configured languages to the code dialog | 1 | Toolbar dialog test | Complete |
| 3 | Update API documentation | 1 | Markdown diff review | Complete |
| 4 | Run verification | 1-3 | `npm test`, `npm run build` | Complete |

## Execution Order

Define the option shape and normalization first, then thread the normalized list through editor construction into toolbar/dialog creation. Tests and docs follow the implementation.

## Current Progress

Implementation, documentation, and verification are complete.

## Verification Log

| Date | Command or Check | Result | Notes |
| --- | --- | --- | --- |
| 2026-07-02 | `npm test` | Passed | 4 test files, 67 tests. |
| 2026-07-02 | `npm run build` | Passed | Type declarations, bundles, and size checks completed. |
| 2026-07-02 | Demo source review | Passed | `demo/index.html` now initializes the editor with the requested `codesample_languages` array. |

## Issues and Resolutions

None so far.

## Follow-ups

None currently planned.

## Notes

The option name intentionally matches the requested JavaScript API spelling: `codesample_languages`.
