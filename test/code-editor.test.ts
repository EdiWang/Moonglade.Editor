import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EditorView } from '@codemirror/view';
import { createMoongladeCodeEditor } from '../src/code-editor';
import { setFormatterRuntimeLoaderForTests } from '../src/code-formatter';

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
  setFormatterRuntimeLoaderForTests(undefined);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

function waitForAsyncWork(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function waitForDebouncedSync(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 250));
}

async function waitForExpectation(assertion: () => void): Promise<void> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await waitForAsyncWork();
    }
  }

  throw lastError;
}

function createClipboardImagePasteEvent(file: File): ClipboardEvent {
  const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;

  Object.defineProperty(event, 'clipboardData', {
    configurable: true,
    value: {
      files: [file],
      getData: () => ''
    }
  });

  return event;
}

function dispatchPasteToEditorContent(host: HTMLElement, event: ClipboardEvent): void {
  const content = host.querySelector('.cm-content') as HTMLElement;
  content.dispatchEvent(event);
}

function getCodeMirrorView(editor: ReturnType<typeof createMoongladeCodeEditor>): EditorView {
  return (editor as unknown as { view: EditorView }).view;
}

describe('code editor public modes', () => {
  it('uses initial content, height, line wrapping, tab size, and textarea sync', () => {
    const host = document.createElement('div');
    const textarea = document.createElement('textarea');
    const inputListener = vi.fn();
    textarea.value = '# From textarea';
    textarea.addEventListener('input', inputListener);

    const editor = createMoongladeCodeEditor({
      element: host,
      textarea,
      language: 'markdown',
      content: '# From options',
      height: '640px',
      lineWrapping: true,
      tabSize: 4
    });

    expect(host.style.height).toBe('640px');
    expect(editor.getValue()).toBe('# From options');
    expect(textarea.value).toBe('# From options');
    expect(inputListener).not.toHaveBeenCalled();
    expect(host.querySelector('.mg-code-editor-toolbar')).not.toBeNull();
    expect(host.querySelector('.cm-editor')).not.toBeNull();

    editor.destroy();
  });

  it('updates value, textarea, and onChange through the public setter', () => {
    const host = document.createElement('div');
    const textarea = document.createElement('textarea');
    const inputListener = vi.fn();
    const onChange = vi.fn();
    textarea.addEventListener('input', inputListener);

    const editor = createMoongladeCodeEditor({
      element: host,
      textarea,
      language: 'html',
      content: '<p>Hello</p>',
      onChange
    });

    editor.setValue('<section>Updated</section>');

    expect(editor.getValue()).toBe('<section>Updated</section>');
    expect(textarea.value).toBe('<section>Updated</section>');
    expect(inputListener).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith('<section>Updated</section>');

    editor.destroy();
  });

  it('notifies the host for explicit textarea sync without pending document changes', () => {
    const host = document.createElement('div');
    const textarea = document.createElement('textarea');
    const inputListener = vi.fn();
    const onChange = vi.fn();
    textarea.addEventListener('input', inputListener);

    const editor = createMoongladeCodeEditor({
      element: host,
      textarea,
      language: 'markdown',
      content: '# Title',
      onChange
    });

    expect(inputListener).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();

    editor.syncToTextarea();

    expect(textarea.value).toBe('# Title');
    expect(inputListener).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith('# Title');

    editor.destroy();
  });

  it('coalesces automatic document changes into a single debounced host notification', () => {
    vi.useFakeTimers();
    try {
      const host = document.createElement('div');
      const textarea = document.createElement('textarea');
      const inputListener = vi.fn();
      const onChange = vi.fn();
      textarea.addEventListener('input', inputListener);
      const editor = createMoongladeCodeEditor({
        element: host,
        textarea,
        language: 'markdown',
        content: '# Title',
        onChange
      });
      const view = getCodeMirrorView(editor);

      view.dispatch({ changes: { from: view.state.doc.length, insert: '\n' } });
      view.dispatch({ changes: { from: view.state.doc.length, insert: 'Body' } });

      expect(editor.getValue()).toBe('# Title\nBody');
      expect(textarea.value).toBe('# Title');
      expect(inputListener).not.toHaveBeenCalled();
      expect(onChange).not.toHaveBeenCalled();

      vi.advanceTimersByTime(199);

      expect(textarea.value).toBe('# Title');
      expect(inputListener).not.toHaveBeenCalled();
      expect(onChange).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);

      expect(textarea.value).toBe('# Title\nBody');
      expect(inputListener).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenLastCalledWith('# Title\nBody');

      editor.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('flushes pending automatic sync when explicitly syncing or destroying', () => {
    vi.useFakeTimers();
    try {
      const host = document.createElement('div');
      const textarea = document.createElement('textarea');
      const inputListener = vi.fn();
      const onChange = vi.fn();
      textarea.addEventListener('input', inputListener);
      const editor = createMoongladeCodeEditor({
        element: host,
        textarea,
        language: 'markdown',
        content: '# Title',
        onChange
      });
      const view = getCodeMirrorView(editor);

      view.dispatch({ changes: { from: view.state.doc.length, insert: '\nBody' } });

      expect(onChange).not.toHaveBeenCalled();

      editor.syncToTextarea();

      expect(textarea.value).toBe('# Title\nBody');
      expect(inputListener).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenLastCalledWith('# Title\nBody');

      view.dispatch({ changes: { from: view.state.doc.length, insert: '\nTail' } });

      expect(onChange).toHaveBeenCalledTimes(1);

      editor.destroy();

      expect(textarea.value).toBe('# Title\nBody\nTail');
      expect(inputListener).toHaveBeenCalledTimes(2);
      expect(onChange).toHaveBeenCalledTimes(2);
      expect(onChange).toHaveBeenLastCalledWith('# Title\nBody\nTail');
    } finally {
      vi.useRealTimers();
    }
  });

  it('switches language compartments without replacing the text buffer', () => {
    const host = document.createElement('div');
    const editor = createMoongladeCodeEditor({
      element: host,
      language: 'markdown',
      content: '# Title'
    });

    editor.setLanguage('css');

    expect(editor.getLanguage()).toBe('css');
    expect(editor.getValue()).toBe('# Title');

    editor.destroy();
  });

  it('toggles read-only toolbar affordances', () => {
    const host = document.createElement('div');
    const editor = createMoongladeCodeEditor({
      element: host,
      language: 'css',
      content: 'body { color: red; }'
    });
    const replaceButton = host.querySelector('[data-command="replace"]') as HTMLButtonElement;
    const formatButton = host.querySelector('[data-command="format"]') as HTMLButtonElement;

    expect(replaceButton.disabled).toBe(false);
    expect(formatButton.disabled).toBe(false);

    editor.setReadOnly(true);

    expect(replaceButton.disabled).toBe(true);
    expect(formatButton.disabled).toBe(true);

    editor.setReadOnly(false);

    expect(replaceButton.disabled).toBe(false);
    expect(formatButton.disabled).toBe(false);

    editor.destroy();
  });

  it('formats through the lazy formatter runtime and reports changed output', async () => {
    const host = document.createElement('div');
    const textarea = document.createElement('textarea');
    const onChange = vi.fn();
    const formatWithPrettier = vi.fn(async () => 'body {\n  color: red;\n}\n');
    setFormatterRuntimeLoaderForTests(async () => ({ formatWithPrettier }));

    const editor = createMoongladeCodeEditor({
      element: host,
      textarea,
      language: 'css',
      content: 'body{color:red}',
      tabSize: 2,
      onChange
    });

    await expect(editor.format()).resolves.toBe(true);

    expect(formatWithPrettier).toHaveBeenCalledWith({
      language: 'css',
      value: 'body{color:red}',
      tabSize: 2
    });
    expect(editor.getValue()).toBe('body {\n  color: red;\n}\n');
    expect(textarea.value).toBe('body {\n  color: red;\n}\n');
    expect(onChange).toHaveBeenLastCalledWith('body {\n  color: red;\n}\n');
    expect(host.querySelector('.mg-code-editor-status')?.textContent).toBe('Formatted.');

    editor.destroy();
  });

  it('reports no-op formatting without changing the buffer', async () => {
    const host = document.createElement('div');
    const formatWithPrettier = vi.fn(async () => '# Title\n');
    setFormatterRuntimeLoaderForTests(async () => ({ formatWithPrettier }));

    const editor = createMoongladeCodeEditor({
      element: host,
      language: 'markdown',
      content: '# Title\n'
    });

    await expect(editor.format()).resolves.toBe(false);

    expect(editor.getValue()).toBe('# Title\n');
    expect(host.querySelector('.mg-code-editor-status')?.textContent).toBe('No formatting changes.');

    editor.destroy();
  });

  it('uploads pasted Markdown images and inserts escaped markdown image syntax', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const file = new File(['fake-image'], 'hello-world.png', { type: 'image/png' });
    const upload = vi.fn(async (uploadedFile: File) => {
      expect(uploadedFile).toBe(file);
      return {
        url: '/media/hello(world).png',
        alt: 'Alt ] text',
        title: 'Title "quoted"'
      };
    });
    const onChange = vi.fn();
    const editor = createMoongladeCodeEditor({
      element: host,
      language: 'markdown',
      content: '',
      markdownImageUpload: {
        upload
      },
      onChange
    });

    const event = createClipboardImagePasteEvent(file);
    dispatchPasteToEditorContent(host, event);

    expect(event.defaultPrevented).toBe(true);

    await waitForExpectation(() => {
      expect(upload).toHaveBeenCalledWith(file);
      expect(editor.getValue()).toBe('![Alt \\] text](</media/hello(world).png> "Title \\"quoted\\"")');
    });

    await waitForDebouncedSync();

    expect(onChange).toHaveBeenLastCalledWith('![Alt \\] text](</media/hello(world).png> "Title \\"quoted\\"")');
    expect(host.querySelector('.mg-code-editor-status')?.textContent).toBe('Inserted 1 image.');

    editor.destroy();
  });

  it('handles Markdown image upload failures without inserting text', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const file = new File(['fake-image'], 'failed.png', { type: 'image/png' });
    const uploadError = new Error('Upload rejected.');
    const upload = vi.fn(async () => {
      throw uploadError;
    });
    const onError = vi.fn();
    const editor = createMoongladeCodeEditor({
      element: host,
      language: 'markdown',
      content: 'Existing',
      markdownImageUpload: {
        upload,
        onError
      }
    });

    const event = createClipboardImagePasteEvent(file);
    dispatchPasteToEditorContent(host, event);

    expect(event.defaultPrevented).toBe(true);

    await waitForExpectation(() => {
      expect(upload).toHaveBeenCalledWith(file);
      expect(onError).toHaveBeenCalledWith(uploadError, file);
      expect(host.querySelector('.mg-code-editor-status')?.textContent).toBe('Image upload failed: Upload rejected.');
    });
    expect(editor.getValue()).toBe('Existing');

    editor.destroy();
  });

  it('rejects unsafe Markdown image upload result URLs', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const file = new File(['fake-image'], 'unsafe.png', { type: 'image/png' });
    const upload = vi.fn(async () => ({
      url: 'javascript:alert(1)',
      alt: 'Unsafe'
    }));
    const onError = vi.fn();
    const editor = createMoongladeCodeEditor({
      element: host,
      language: 'markdown',
      content: 'Existing',
      markdownImageUpload: {
        upload,
        onError
      }
    });

    const event = createClipboardImagePasteEvent(file);
    dispatchPasteToEditorContent(host, event);

    expect(event.defaultPrevented).toBe(true);

    await waitForExpectation(() => {
      expect(upload).toHaveBeenCalledWith(file);
      expect(onError).toHaveBeenCalledWith(expect.any(TypeError), file);
      expect(host.querySelector('.mg-code-editor-status')?.textContent)
        .toBe('Image upload failed: Moonglade.Editor markdown image upload result url must be a safe image URL.');
    });
    expect(editor.getValue()).toBe('Existing');

    editor.destroy();
  });

  it('ignores pasted Markdown images outside the default extension allowlist', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const file = new File(['fake-image'], 'animation.gif', { type: 'image/gif' });
    const upload = vi.fn(async () => '/media/animation.gif');
    const editor = createMoongladeCodeEditor({
      element: host,
      language: 'markdown',
      content: 'Existing',
      markdownImageUpload: {
        upload
      }
    });

    const event = createClipboardImagePasteEvent(file);
    dispatchPasteToEditorContent(host, event);
    await waitForAsyncWork();

    expect(upload).not.toHaveBeenCalled();
    expect(editor.getValue()).toBe('Existing');

    editor.destroy();
  });

  it('uses custom Markdown image upload extension allowlists', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const file = new File(['fake-image'], 'animation.gif', { type: 'image/gif' });
    const upload = vi.fn(async () => '/media/animation.gif');
    const editor = createMoongladeCodeEditor({
      element: host,
      language: 'markdown',
      content: '',
      markdownImageUpload: {
        upload,
        allowedImageExtensions: ['gif']
      }
    });

    const event = createClipboardImagePasteEvent(file);
    dispatchPasteToEditorContent(host, event);

    expect(event.defaultPrevented).toBe(true);

    await waitForExpectation(() => {
      expect(upload).toHaveBeenCalledWith(file);
      expect(editor.getValue()).toBe('![animation](/media/animation.gif)');
    });

    expect(host.querySelector('.mg-code-editor-status')?.textContent).toBe('Inserted 1 image.');

    editor.destroy();
  });

  it('rejects invalid Markdown image upload extension allowlists', () => {
    const host = document.createElement('div');

    expect(() => createMoongladeCodeEditor({
      element: host,
      language: 'markdown',
      markdownImageUpload: {
        upload: async () => '/media/image.png',
        allowedImageExtensions: ['.png', 42] as unknown as string[]
      }
    })).toThrow('Moonglade.Editor markdownImageUpload.allowedImageExtensions must be an array of strings.');
  });

  it('ignores pasted images outside Markdown mode', async () => {
    const host = document.createElement('div');
    const file = new File(['fake-image'], 'ignored.png', { type: 'image/png' });
    const upload = vi.fn(async () => '/media/ignored.png');
    const editor = createMoongladeCodeEditor({
      element: host,
      language: 'html',
      content: '<p>Hello</p>',
      markdownImageUpload: {
        upload
      }
    });

    const event = createClipboardImagePasteEvent(file);
    dispatchPasteToEditorContent(host, event);
    await waitForAsyncWork();

    expect(upload).not.toHaveBeenCalled();
    expect(editor.getValue()).toBe('<p>Hello</p>');

    editor.destroy();
  });

  it('throws clear errors after the instance is destroyed', () => {
    const host = document.createElement('div');
    const editor = createMoongladeCodeEditor({
      element: host,
      language: 'css',
      content: 'body {}'
    });

    editor.destroy();
    editor.destroy();

    expect(() => editor.getValue()).toThrow('Moonglade.Editor code editor instance has been destroyed.');
    expect(() => editor.setValue('body { color: red; }')).toThrow('Moonglade.Editor code editor instance has been destroyed.');
    expect(() => editor.focus()).toThrow('Moonglade.Editor code editor instance has been destroyed.');
  });
});
