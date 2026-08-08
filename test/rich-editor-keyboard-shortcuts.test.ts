import { describe, expect, it } from 'vitest';
import { TextSelection } from 'prosemirror-state';
import { createMoongladeEditor, type MoongladeEditor } from '../src/editor';
import { installRichEditorTestEnvironment } from './rich-editor-test-helpers';

installRichEditorTestEnvironment();

describe('rich editor keyboard shortcuts', () => {
  it.each([
    ['b', '<p><strong>Hello</strong> world</p>'],
    ['i', '<p><em>Hello</em> world</p>'],
    ['u', '<p><u>Hello</u> world</p>']
  ])('applies Ctrl+%s to selected text', (key, expectedHtml) => {
    const host = document.createElement('div');
    const editor = createMoongladeEditor({
      element: host,
      content: '<p>Hello world</p>'
    });

    selectText(editor, 'Hello');
    const handled = pressShortcut(editor, key, { ctrlKey: true });

    expect(handled).toBe(true);
    expect(editor.getHTML()).toBe(expectedHtml);

    editor.destroy();
  });

  it('applies Ctrl+Shift+X to selected text as strikethrough', () => {
    const host = document.createElement('div');
    const editor = createMoongladeEditor({
      element: host,
      content: '<p>Hello world</p>'
    });

    selectText(editor, 'Hello');
    const handled = pressShortcut(editor, 'x', { ctrlKey: true, shiftKey: true });

    expect(handled).toBe(true);
    expect(editor.getHTML()).toBe('<p><s>Hello</s> world</p>');

    editor.destroy();
  });

  it('applies Ctrl+` to selected text as inline code', () => {
    const host = document.createElement('div');
    const editor = createMoongladeEditor({
      element: host,
      content: '<p>Hello world</p>'
    });

    selectText(editor, 'Hello');
    const handled = pressShortcut(editor, '`', { ctrlKey: true });

    expect(handled).toBe(true);
    expect(editor.getHTML()).toBe('<p><code>Hello</code> world</p>');

    editor.destroy();
  });
});

function selectText(editor: MoongladeEditor, text: string): void {
  const start = findTextPosition(editor, text);
  editor.run((state, dispatch) => {
    dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, start, start + text.length)));
    return true;
  });
}

function findTextPosition(editor: MoongladeEditor, text: string): number {
  let textPosition = -1;

  editor.doc.descendants((node, pos) => {
    if (node.isText && node.text?.includes(text)) {
      textPosition = pos + node.text.indexOf(text);
      return false;
    }

    return true;
  });

  if (textPosition === -1) {
    throw new Error(`Unable to find text "${text}".`);
  }

  return textPosition;
}

function pressShortcut(
  editor: MoongladeEditor,
  key: string,
  options: Pick<KeyboardEventInit, 'ctrlKey' | 'metaKey' | 'shiftKey'>
): boolean {
  const event = new KeyboardEvent('keydown', {
    key,
    code: getKeyboardCode(key),
    bubbles: true,
    cancelable: true,
    ...options
  });

  Object.defineProperty(event, 'keyCode', {
    configurable: true,
    value: getKeyboardKeyCode(key)
  });

  return !editor.dom.dispatchEvent(event);
}

function getKeyboardCode(key: string): string {
  if (/^[a-z]$/i.test(key)) {
    return `Key${key.toUpperCase()}`;
  }

  if (key === '`') {
    return 'Backquote';
  }

  return key;
}

function getKeyboardKeyCode(key: string): number {
  if (/^[a-z]$/i.test(key)) {
    return key.toUpperCase().charCodeAt(0);
  }

  if (key === '`') {
    return 192;
  }

  return 0;
}
