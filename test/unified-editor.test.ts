import { afterEach, describe, expect, it } from 'vitest';
import {
  createMoongladeCodeEditor,
  createMoongladeEditor,
  MoongladeCodeEditor,
  MoongladeEditor
} from '../src';

const emptyClientRects = {
  length: 0,
  item: () => null,
  [Symbol.iterator]: function* iterator() {
    return;
  }
} as DOMRectList;

Range.prototype.getClientRects = () => emptyClientRects;
Range.prototype.getBoundingClientRect = () => new DOMRect();

afterEach(() => {
  document.body.replaceChildren();
});

describe('unified editor entry point', () => {
  it('creates the rich HTML editor when mode is omitted', () => {
    const element = document.createElement('div');
    const editor = createMoongladeEditor({
      element,
      content: '<p>Hello</p>'
    });

    expect(editor).toBeInstanceOf(MoongladeEditor);
    expect('getHTML' in editor).toBe(true);
    expect(editor.syncToTextarea).toBeTypeOf('function');

    editor.destroy();
  });

  it('creates a CodeMirror editor for code-like modes', () => {
    const element = document.createElement('div');
    const textarea = document.createElement('textarea');
    const editor = createMoongladeEditor({
      mode: 'markdown',
      element,
      textarea,
      content: '# Hello',
      lineWrapping: true
    });

    expect(editor).toBeInstanceOf(MoongladeCodeEditor);
    expect('getValue' in editor).toBe(true);
    expect(editor.getValue()).toBe('# Hello');
    expect(textarea.value).toBe('# Hello');

    editor.destroy();
  });

  it('keeps the old code editor factory available during migration', () => {
    const element = document.createElement('div');
    const editor = createMoongladeCodeEditor({
      element,
      language: 'css',
      content: 'body { color: red; }'
    });

    expect(editor).toBeInstanceOf(MoongladeCodeEditor);
    expect(editor.getLanguage()).toBe('css');

    editor.destroy();
  });
});
