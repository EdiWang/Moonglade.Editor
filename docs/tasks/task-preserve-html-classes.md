# Preserve HTML Classes

## Original Goal

Fix the bug where editing HTML source to add `class` attributes, such as `<table class="custom-table">` or `<ul class="abc">`, loses those attributes after saving and reopening source mode.

## Background

Moonglade.Editor stores post content as constrained HTML. Source mode re-enters through `parseHtml(...)`, so class attributes must be represented in the ProseMirror schema to survive parse/serialize round trips. Arbitrary source HTML should still pass through sanitizer and schema constraints.

## Scope

Add a constrained schema path for safe custom class attributes on schema-supported elements, update safety tests, and verify source-mode round trips keep both table and list classes.

## Out of Scope

Do not preserve classes on unsupported/unknown HTML tags, add class editing UI controls, or add broader word-processor styling features.

## Task Breakdown

| No. | Task | Dependencies | Verification | Status |
| --- | --- | --- | --- | --- |
| 1 | Add a sanitizer for safe custom class attributes | None | Unit tests | Complete |
| 2 | Store sanitized class attributes on schema-supported nodes and marks | 1 | HTML round-trip tests | Complete |
| 3 | Cover source-dialog save/reopen behavior for table and list classes | 2 | Editor jsdom test | Complete |
| 4 | Run project verification | 1-3 | `npm test`, `npm run build` | Complete |

## Execution Order

Implement the sanitizer first, wire it into class-aware schema wrappers, then add focused tests around HTML round trips and source mode behavior.

## Current Progress

Implemented a constrained class attribute sanitizer, wired it into ProseMirror node/mark schema wrappers for supported elements, added round-trip/source-mode tests, and updated documentation for the new persistent HTML rule.

## Verification Log

| Date | Command or Check | Result | Notes |
| --- | --- | --- | --- |
| 2026-07-02 | `npm test` | Passed | 72 Vitest/jsdom tests. |
| 2026-07-02 | `npm run build` | Passed | Type declarations, bundles, CSS copy, and size budgets passed. |

## Issues and Resolutions

- Issue: Source edits to add class attributes, such as `<table class="custom-table">` and `<ul class="abc">`, were lost.
- Root cause: The ProseMirror schema did not define a `class` attribute for supported nodes/marks, so schema parsing dropped it even after unsafe attribute cleanup.
- Resolution: Added sanitized `class` attributes through reusable schema wrappers and preserved safe class tokens during parse and serialization.

## Follow-ups

None expected.

## Notes

Keep the fix narrow: preserve safe class tokens only on schema-supported elements; do not admit unsupported tags.
