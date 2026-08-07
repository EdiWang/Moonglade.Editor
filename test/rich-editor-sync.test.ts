import { describe, expect, it, vi } from 'vitest';
import { createMoongladeEditor } from '../src/editor';
import { installRichEditorTestEnvironment, waitForAsyncWork, waitForExpectation } from './rich-editor-test-helpers';

installRichEditorTestEnvironment();

describe('rich editor sync and lifecycle', () => {
  it('enables spellcheck by default and can toggle it after initialization', () => {
    const host = document.createElement('div');
    const editor = createMoongladeEditor({
      element: host,
      content: '<p>Hello</p>'
    });

    expect(editor.getSpellcheck()).toBe(true);
    expect(editor.dom.getAttribute('spellcheck')).toBe('true');

    editor.setSpellcheck(false);

    expect(editor.getSpellcheck()).toBe(false);
    expect(editor.dom.getAttribute('spellcheck')).toBe('false');

    editor.destroy();
  });

  it('honors disabled spellcheck during initialization', () => {
    const host = document.createElement('div');
    const editor = createMoongladeEditor({
      element: host,
      content: '<p>Hello</p>',
      spellcheck: false
    });

    expect(editor.getSpellcheck()).toBe(false);
    expect(editor.dom.getAttribute('spellcheck')).toBe('false');

    editor.destroy();
  });

  it('keeps code blocks spellcheck-disabled independently of the editor setting', () => {
    const host = document.createElement('div');
    const editor = createMoongladeEditor({
      element: host,
      content: '<pre><code>const answer = 42;</code></pre>',
      spellcheck: true
    });
    const codeBlock = host.querySelector('.ProseMirror pre') as HTMLPreElement;

    expect(editor.dom.getAttribute('spellcheck')).toBe('true');
    expect(codeBlock.getAttribute('spellcheck')).toBe('false');

    editor.setSpellcheck(false);

    expect(editor.dom.getAttribute('spellcheck')).toBe('false');
    expect(codeBlock.getAttribute('spellcheck')).toBe('false');
    expect(editor.getHTML()).toBe('<pre><code>const answer = 42;</code></pre>');

    editor.destroy();
  });

  it('disables spellcheck on code blocks added after initialization', () => {
    const host = document.createElement('div');
    const editor = createMoongladeEditor({
      element: host,
      content: '<p>Hello</p>',
      spellcheck: true
    });

    expect(host.querySelector('.ProseMirror pre')).toBeNull();

    editor.setHTML('<pre><code>const answer = 42;</code></pre>');

    const codeBlock = host.querySelector('.ProseMirror pre') as HTMLPreElement;
    expect(codeBlock).not.toBeNull();
    expect(codeBlock.getAttribute('spellcheck')).toBe('false');

    editor.destroy();
  });

  it('syncs initial textarea content without notifying the host during initialization', () => {
    const host = document.createElement('div');
    const textarea = document.createElement('textarea');
    const inputListener = vi.fn();
    const onChange = vi.fn();
    textarea.value = '<p>Original</p>';
    textarea.addEventListener('input', inputListener);

    const editor = createMoongladeEditor({
      element: host,
      textarea,
      content: '<p>Hello</p>',
      onChange
    });

    expect(textarea.value).toBe('<p>Hello</p>');
    expect(inputListener).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();

    editor.destroy();
  });

  it('notifies the host for edits, setHTML, and explicit textarea sync', () => {
    vi.useFakeTimers();
    try {
      const host = document.createElement('div');
      const textarea = document.createElement('textarea');
      const inputListener = vi.fn();
      const onChange = vi.fn();
      textarea.addEventListener('input', inputListener);

      const editor = createMoongladeEditor({
        element: host,
        textarea,
        content: '<p>Hello</p>',
        onChange
      });

      editor.run((state, dispatch) => {
        dispatch?.(state.tr.insertText('!', 6));
        return true;
      });

      // getHTML stays immediate; the textarea/onChange write is debounced.
      expect(editor.getHTML()).toBe('<p>Hello!</p>');
      expect(inputListener).not.toHaveBeenCalled();
      expect(onChange).not.toHaveBeenCalled();

      vi.advanceTimersByTime(300);

      expect(textarea.value).toBe('<p>Hello!</p>');
      expect(inputListener).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenLastCalledWith('<p>Hello!</p>');

      editor.setHTML('<p>Updated</p>');

      expect(textarea.value).toBe('<p>Updated</p>');
      expect(inputListener).toHaveBeenCalledTimes(2);
      expect(onChange).toHaveBeenLastCalledWith('<p>Updated</p>');

      editor.syncToTextarea();

      expect(inputListener).toHaveBeenCalledTimes(3);
      expect(onChange).toHaveBeenCalledTimes(3);
      expect(onChange).toHaveBeenLastCalledWith('<p>Updated</p>');

      editor.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('coalesces rapid edits into a single debounced host notification', () => {
    vi.useFakeTimers();
    try {
      const host = document.createElement('div');
      const onChange = vi.fn();
      const editor = createMoongladeEditor({
        element: host,
        content: '<p>Hi</p>',
        onChange
      });

      editor.run((state, dispatch) => {
        dispatch?.(state.tr.insertText('a', 3));
        return true;
      });
      editor.run((state, dispatch) => {
        dispatch?.(state.tr.insertText('b', 4));
        return true;
      });
      editor.run((state, dispatch) => {
        dispatch?.(state.tr.insertText('c', 5));
        return true;
      });

      expect(onChange).not.toHaveBeenCalled();
      expect(editor.getHTML()).toBe('<p>Hiabc</p>');

      vi.advanceTimersByTime(300);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenLastCalledWith('<p>Hiabc</p>');

      editor.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('flushes a pending debounced notification on destroy', () => {
    vi.useFakeTimers();
    try {
      const host = document.createElement('div');
      const onChange = vi.fn();
      const editor = createMoongladeEditor({
        element: host,
        content: '<p>Hi</p>',
        onChange
      });

      editor.run((state, dispatch) => {
        dispatch?.(state.tr.insertText('!', 3));
        return true;
      });

      expect(onChange).not.toHaveBeenCalled();

      editor.destroy();

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenLastCalledWith('<p>Hi!</p>');
    } finally {
      vi.useRealTimers();
    }
  });

  it('makes destroy idempotent and rejects public instance methods after destroy', () => {
    const host = document.createElement('div');
    const editor = createMoongladeEditor({
      element: host,
      content: '<p>Hello</p>'
    });
    const expectedMessage = 'Moonglade.Editor rich HTML editor instance has been destroyed.';

    expect(() => editor.destroy()).not.toThrow();
    expect(() => editor.destroy()).not.toThrow();

    expect(() => editor.dom).toThrow(expectedMessage);
    expect(() => editor.doc).toThrow(expectedMessage);
    expect(() => editor.getHTML()).toThrow(expectedMessage);
    expect(() => editor.setHTML('<p>Updated</p>')).toThrow(expectedMessage);
    expect(() => editor.run(editor.commands.bold)).toThrow(expectedMessage);
    expect(() => editor.focus()).toThrow(expectedMessage);
    expect(() => editor.getSpellcheck()).toThrow(expectedMessage);
    expect(() => editor.setSpellcheck(false)).toThrow(expectedMessage);
    expect(() => editor.syncToTextarea()).toThrow(expectedMessage);
  });

});
