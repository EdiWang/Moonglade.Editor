import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import {
  bracketMatching,
  foldGutter,
  foldKeymap,
  indentOnInput
} from '@codemirror/language';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import type { Extension } from '@codemirror/state';
import {
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  type KeyBinding,
  keymap,
  lineNumbers,
  rectangularSelection,
  type ViewUpdate
} from '@codemirror/view';

export type SearchPanelFocusTarget = 'search' | 'replace';

interface CodeMirrorBaseExtensionOptions {
  theme: Extension;
  language: Extension;
  lineWrapping?: boolean;
  extraExtensions?: readonly Extension[];
  keymapBindings?: readonly KeyBinding[];
  onDocChanged?: (update: ViewUpdate) => void;
}

export function createCodeMirrorBaseExtensions({
  theme,
  language,
  lineWrapping = false,
  extraExtensions = [],
  keymapBindings = createDefaultCodeMirrorKeymap(),
  onDocChanged
}: CodeMirrorBaseExtensionOptions): Extension[] {
  const extensions: Extension[] = [
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
    theme,
    highlightSelectionMatches(),
    language
  ];

  if (lineWrapping) {
    extensions.push(EditorView.lineWrapping);
  }

  extensions.push(...extraExtensions);

  if (onDocChanged) {
    extensions.push(EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onDocChanged(update);
      }
    }));
  }

  extensions.push(keymap.of(keymapBindings));

  return extensions;
}

export function createDefaultCodeMirrorKeymap(): KeyBinding[] {
  return [
    ...defaultKeymap,
    ...historyKeymap,
    ...foldKeymap,
    ...searchKeymap,
    indentWithTab
  ];
}

export function focusCodeMirrorSearchPanelField(root: ParentNode, focusTarget: SearchPanelFocusTarget): void {
  const focus = () => {
    const field =
      root.querySelector<HTMLInputElement>(`.cm-search input[name="${focusTarget}"]`) ??
      root.querySelector<HTMLInputElement>('.cm-search input');

    field?.focus();
    field?.select();
  };

  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(focus);
    return;
  }

  focus();
}
