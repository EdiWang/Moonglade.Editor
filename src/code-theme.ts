import {
  HighlightStyle,
  syntaxHighlighting
} from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { tags } from '@lezer/highlight';

const moongladeHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--mg-code-syntax-keyword)' },
  { tag: [tags.atom, tags.bool, tags.url, tags.labelName], color: 'var(--mg-code-syntax-atom)' },
  { tag: [tags.number, tags.integer, tags.float], color: 'var(--mg-code-syntax-number)' },
  { tag: [tags.string, tags.special(tags.string), tags.docString], color: 'var(--mg-code-syntax-string)' },
  { tag: tags.regexp, color: 'var(--mg-code-syntax-regexp)' },
  { tag: tags.comment, color: 'var(--mg-code-syntax-comment)', fontStyle: 'italic' },
  { tag: tags.definition(tags.variableName), color: 'var(--mg-code-syntax-definition)' },
  { tag: [tags.variableName, tags.self], color: 'var(--mg-code-syntax-variable)' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: 'var(--mg-code-syntax-function)' },
  { tag: [tags.typeName, tags.className, tags.namespace], color: 'var(--mg-code-syntax-type)' },
  { tag: tags.propertyName, color: 'var(--mg-code-syntax-property)' },
  { tag: tags.operator, color: 'var(--mg-code-syntax-operator)' },
  { tag: tags.tagName, color: 'var(--mg-code-syntax-tag)' },
  { tag: tags.attributeName, color: 'var(--mg-code-syntax-attribute)' },
  { tag: tags.heading, color: 'var(--mg-code-syntax-heading)', fontWeight: '600' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.link, color: 'var(--mg-code-syntax-link)', textDecoration: 'underline' },
  { tag: [tags.meta, tags.processingInstruction], color: 'var(--mg-code-syntax-meta)' },
  { tag: tags.invalid, color: 'var(--mg-code-syntax-invalid)' }
]);

export function createMoongladeCodeEditorTheme(): Extension[] {
  return [
    EditorView.theme({
      '&': {
        backgroundColor: 'var(--mg-code-editor-bg)',
        color: 'var(--mg-code-editor-fg)'
      },
      '.cm-content': {
        caretColor: 'var(--mg-code-caret)'
      },
      '&.cm-focused .cm-cursor': {
        borderLeftColor: 'var(--mg-code-caret)'
      },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
        backgroundColor: 'var(--mg-code-selection-bg)'
      },
      '.cm-panels': {
        backgroundColor: 'var(--mg-code-panel-bg)',
        borderColor: 'var(--mg-code-border)',
        color: 'var(--mg-code-editor-fg)'
      },
      '.cm-searchMatch': {
        backgroundColor: 'var(--mg-code-search-match-bg)',
        outline: '1px solid var(--mg-code-search-match-border)'
      },
      '.cm-searchMatch.cm-searchMatch-selected': {
        backgroundColor: 'var(--mg-code-search-match-selected-bg)'
      },
      '.cm-tooltip': {
        backgroundColor: 'var(--mg-code-panel-bg)',
        borderColor: 'var(--mg-code-border)',
        color: 'var(--mg-code-editor-fg)'
      },
      '.cm-tooltip-autocomplete ul li[aria-selected]': {
        backgroundColor: 'var(--mg-code-selection-bg)',
        color: 'var(--mg-code-editor-fg)'
      },
      '.cm-matchingBracket, .cm-nonmatchingBracket': {
        backgroundColor: 'var(--mg-code-bracket-bg)',
        outline: '1px solid var(--mg-code-bracket-border)'
      },
      '.cm-foldPlaceholder': {
        backgroundColor: 'var(--mg-code-panel-bg)',
        borderColor: 'var(--mg-code-border)',
        color: 'var(--mg-code-muted)'
      }
    }),
    syntaxHighlighting(moongladeHighlightStyle)
  ];
}
