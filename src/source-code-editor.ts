import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { html } from '@codemirror/lang-html';
import {
  bracketMatching,
  foldGutter,
  foldKeymap,
  HighlightStyle,
  indentOnInput,
  syntaxHighlighting
} from '@codemirror/language';
import { highlightSelectionMatches, openSearchPanel, searchKeymap } from '@codemirror/search';
import { EditorState, type Extension } from '@codemirror/state';
import {
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection
} from '@codemirror/view';
import { tags } from '@lezer/highlight';

type SearchPanelFocusTarget = 'search' | 'replace';

const sourceHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--mg-source-syntax-keyword)' },
  { tag: [tags.atom, tags.bool, tags.url, tags.labelName], color: 'var(--mg-source-syntax-atom)' },
  { tag: [tags.number, tags.integer, tags.float], color: 'var(--mg-source-syntax-number)' },
  { tag: [tags.string, tags.special(tags.string), tags.docString], color: 'var(--mg-source-syntax-string)' },
  { tag: tags.regexp, color: 'var(--mg-source-syntax-regexp)' },
  { tag: tags.comment, color: 'var(--mg-source-syntax-comment)', fontStyle: 'italic' },
  { tag: tags.definition(tags.variableName), color: 'var(--mg-source-syntax-definition)' },
  { tag: [tags.variableName, tags.self], color: 'var(--mg-source-syntax-variable)' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: 'var(--mg-source-syntax-function)' },
  { tag: [tags.typeName, tags.className, tags.namespace], color: 'var(--mg-source-syntax-type)' },
  { tag: tags.propertyName, color: 'var(--mg-source-syntax-property)' },
  { tag: tags.operator, color: 'var(--mg-source-syntax-operator)' },
  { tag: tags.tagName, color: 'var(--mg-source-syntax-tag)' },
  { tag: tags.attributeName, color: 'var(--mg-source-syntax-attribute)' },
  { tag: tags.heading, color: 'var(--mg-source-syntax-heading)', fontWeight: '600' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.link, color: 'var(--mg-source-syntax-link)', textDecoration: 'underline' },
  { tag: [tags.meta, tags.processingInstruction], color: 'var(--mg-source-syntax-meta)' },
  { tag: tags.invalid, color: 'var(--mg-source-syntax-invalid)' }
]);

export class HtmlSourceCodeEditor {
  readonly root: HTMLDivElement;
  readonly textarea: HTMLTextAreaElement;

  private readonly view: EditorView;

  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'mg-editor-source-code-editor';

    this.textarea = document.createElement('textarea');
    this.textarea.className = 'mg-editor-source-textarea';
    this.textarea.name = 'source';
    this.textarea.hidden = true;
    this.textarea.spellcheck = false;
    this.textarea.setAttribute('aria-label', 'HTML source');

    const host = document.createElement('div');
    host.className = 'mg-editor-source-code-host';
    this.root.append(host, this.textarea);

    this.view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: '',
        extensions: this.createExtensions()
      })
    });
  }

  getValue(): string {
    return this.view.state.doc.toString();
  }

  setValue(value: string): void {
    this.view.dispatch({
      changes: {
        from: 0,
        to: this.view.state.doc.length,
        insert: value
      },
      selection: {
        anchor: 0
      },
      effects: EditorView.scrollIntoView(0, { y: 'start' })
    });
    this.syncTextarea();
    this.view.scrollDOM.scrollTop = 0;
  }

  focus(): void {
    this.view.focus();
  }

  openSearchPanel(focusTarget: SearchPanelFocusTarget): void {
    openSearchPanel(this.view);
    this.focusSearchPanelField(focusTarget);
  }

  destroy(): void {
    this.view.destroy();
  }

  private createExtensions(): Extension[] {
    return [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      foldGutter(),
      drawSelection(),
      dropCursor(),
      rectangularSelection(),
      highlightActiveLine(),
      indentOnInput(),
      bracketMatching(),
      createSourceCodeEditorTheme(),
      highlightSelectionMatches(),
      html(),
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          this.syncTextarea();
        }
      }),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...searchKeymap,
        indentWithTab
      ])
    ];
  }

  private focusSearchPanelField(focusTarget: SearchPanelFocusTarget): void {
    const focus = () => {
      const field =
        this.root.querySelector<HTMLInputElement>(`.cm-search input[name="${focusTarget}"]`) ??
        this.root.querySelector<HTMLInputElement>('.cm-search input');

      field?.focus();
      field?.select();
    };

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(focus);
      return;
    }

    focus();
  }

  private syncTextarea(): void {
    this.textarea.value = this.getValue();
  }
}

function createSourceCodeEditorTheme(): Extension[] {
  return [
    EditorView.theme({
      '&': {
        backgroundColor: 'var(--mg-source-editor-bg)',
        color: 'var(--mg-source-editor-fg)'
      },
      '.cm-content': {
        caretColor: 'var(--mg-source-caret)'
      },
      '&.cm-focused .cm-cursor': {
        borderLeftColor: 'var(--mg-source-caret)'
      },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
        backgroundColor: 'var(--mg-source-selection-bg)'
      },
      '.cm-panels': {
        backgroundColor: 'var(--mg-source-panel-bg)',
        borderColor: 'var(--mg-source-border)',
        color: 'var(--mg-source-editor-fg)'
      },
      '.cm-searchMatch': {
        backgroundColor: 'var(--mg-source-search-match-bg)',
        outline: '1px solid var(--mg-source-search-match-border)'
      },
      '.cm-searchMatch.cm-searchMatch-selected': {
        backgroundColor: 'var(--mg-source-search-match-selected-bg)'
      },
      '.cm-matchingBracket, .cm-nonmatchingBracket': {
        backgroundColor: 'var(--mg-source-bracket-bg)',
        outline: '1px solid var(--mg-source-bracket-border)'
      },
      '.cm-foldPlaceholder': {
        backgroundColor: 'var(--mg-source-panel-bg)',
        borderColor: 'var(--mg-source-border)',
        color: 'var(--mg-source-muted)'
      }
    }),
    syntaxHighlighting(sourceHighlightStyle)
  ];
}
