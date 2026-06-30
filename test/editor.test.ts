import { afterEach, describe, expect, it, vi } from 'vitest';
import { TextSelection } from 'prosemirror-state';
import { createMoongladeEditor } from '../src/editor';

afterEach(() => {
  vi.unstubAllGlobals();
});

function waitForAsyncWork(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
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

describe('editor toolbar', () => {
  it('renders a Bootstrap-compatible toolbar shell', () => {
    const host = document.createElement('div');
    const editor = createMoongladeEditor({
      element: host,
      content: '<p>Hello</p>'
    });

    expect(host.classList.contains('mg-editor')).toBe(true);
    expect(host.classList.contains('card')).toBe(true);
    expect(host.querySelector('[role="toolbar"]')).not.toBeNull();
    expect(host.querySelector('[role="toolbar"]')?.classList.contains('btn-toolbar')).toBe(true);
    expect(host.querySelector('.mg-editor-format')?.classList.contains('form-select')).toBe(true);
    expect(host.querySelector('[data-command="bold"]')?.classList.contains('btn')).toBe(true);
    expect(host.querySelector('[data-command="bold"]')?.textContent).toBe('');
    expect(host.querySelector('[data-command="bold"] .bi-type-bold')).not.toBeNull();
    expect(host.querySelector('[data-command="undo"] .bi-arrow-counterclockwise')).not.toBeNull();
    expect(host.querySelector('[data-command="text_color:clear"] .bi-eraser')).not.toBeNull();
    expect(host.querySelector('.mg-editor-dialog')?.classList.contains('dropdown-menu')).toBe(true);
    expect(host.querySelector('[data-command="bold"]')).not.toBeNull();
    expect(host.querySelector('[data-command="undo"]')).not.toBeNull();

    editor.destroy();
  });

  it('wires the block format selector to editor commands', () => {
    const host = document.createElement('div');
    const editor = createMoongladeEditor({
      element: host,
      content: '<p>Hello</p>'
    });
    const formatSelect = host.querySelector('.mg-editor-format') as HTMLSelectElement;

    formatSelect.value = 'heading:2';
    formatSelect.dispatchEvent(new Event('change', { bubbles: true }));

    expect(editor.getHTML()).toBe('<h2>Hello</h2>');

    editor.destroy();
  });

  it('toggles block controls and reflects active state', () => {
    const host = document.createElement('div');
    const editor = createMoongladeEditor({
      element: host,
      content: '<p>Hello</p>'
    });
    const blockquoteButton = host.querySelector('[data-command="blockquote"]') as HTMLButtonElement;

    blockquoteButton.click();

    expect(editor.getHTML()).toBe('<blockquote><p>Hello</p></blockquote>');
    expect(blockquoteButton.getAttribute('aria-pressed')).toBe('true');

    blockquoteButton.click();

    expect(editor.getHTML()).toBe('<p>Hello</p>');
    expect(blockquoteButton.getAttribute('aria-pressed')).toBe('false');

    editor.destroy();
  });

  it('updates toolbar state when content changes', () => {
    const host = document.createElement('div');
    const editor = createMoongladeEditor({
      element: host,
      content: '<p>Hello</p>'
    });
    const formatSelect = host.querySelector('.mg-editor-format') as HTMLSelectElement;

    editor.setHTML('<h3>Title</h3>');

    expect(formatSelect.value).toBe('heading:3');

    editor.destroy();
  });

  it('rejects unsafe link command URLs', () => {
    const host = document.createElement('div');
    const editor = createMoongladeEditor({
      element: host,
      content: '<p>Hello</p>'
    });

    editor.run((state, dispatch) => {
      dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, 1, 6)));
      return true;
    });

    expect(editor.run(editor.commands.link('javascript:alert(1)'))).toBe(false);
    expect(editor.getHTML()).toBe('<p>Hello</p>');

    editor.destroy();
  });

  it('adds and removes links through the toolbar dialog', () => {
    const host = document.createElement('div');
    const editor = createMoongladeEditor({
      element: host,
      content: '<p>Hello world</p>'
    });

    editor.run((state, dispatch) => {
      dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, 1, 6)));
      return true;
    });

    (host.querySelector('[data-command="link"]') as HTMLButtonElement).click();

    const dialog = host.querySelector('.mg-editor-dialog') as HTMLDivElement;
    const form = dialog.querySelector('form') as HTMLFormElement;
    const hrefInput = dialog.querySelector('[name="href"]') as HTMLInputElement;
    const titleInput = dialog.querySelector('[name="title"]') as HTMLInputElement;

    expect(dialog.hidden).toBe(false);

    hrefInput.value = 'https://example.com';
    titleInput.value = 'Example';
    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));

    expect(dialog.hidden).toBe(true);
    expect(editor.getHTML()).toBe('<p><a href="https://example.com" title="Example">Hello</a> world</p>');

    (host.querySelector('[data-command="link"]') as HTMLButtonElement).click();
    (dialog.querySelector('button.btn-outline-danger') as HTMLButtonElement).click();

    expect(editor.getHTML()).toBe('<p>Hello world</p>');

    editor.destroy();
  });

  it('applies foreground and background colors from toolbar swatches', () => {
    const host = document.createElement('div');
    const editor = createMoongladeEditor({
      element: host,
      content: '<p>Hello</p>'
    });

    editor.run((state, dispatch) => {
      dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, 1, 6)));
      return true;
    });

    (host.querySelector('[aria-label="Text color: Blue"]') as HTMLButtonElement).click();
    expect(editor.getHTML()).toBe('<p><span style="color: rgb(13, 110, 253);">Hello</span></p>');

    editor.run((state, dispatch) => {
      dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, 1, 6)));
      return true;
    });
    (host.querySelector('[aria-label="Background color: Yellow"]') as HTMLButtonElement).click();

    expect(editor.getHTML()).toBe('<p><span style="color: rgb(13, 110, 253);"><span style="background-color: rgb(255, 193, 7);">Hello</span></span></p>');

    editor.destroy();
  });

  it('applies text alignment from toolbar buttons', () => {
    const host = document.createElement('div');
    const editor = createMoongladeEditor({
      element: host,
      content: '<p>Hello</p>'
    });
    const centerButton = host.querySelector('[data-command="alignCenter"]') as HTMLButtonElement;

    centerButton.click();

    expect(editor.getHTML()).toBe('<p style="text-align: center;">Hello</p>');
    expect(centerButton.getAttribute('aria-pressed')).toBe('true');

    editor.destroy();
  });

  it('creates a language-tagged code block from the toolbar dialog', () => {
    const host = document.createElement('div');
    const editor = createMoongladeEditor({
      element: host,
      content: '<p>const answer = 42;</p>'
    });

    (host.querySelector('[data-command="codeBlock"]') as HTMLButtonElement).click();

    const dialog = host.querySelector('.mg-editor-dialog[aria-label="Code snippet"]') as HTMLDivElement;
    const form = dialog.querySelector('form') as HTMLFormElement;
    const languageSelect = dialog.querySelector('[name="language"]') as HTMLSelectElement;

    expect(dialog.hidden).toBe(false);

    languageSelect.value = 'javascript';
    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));

    expect(dialog.hidden).toBe(true);
    expect(editor.getHTML()).toBe('<pre><code class="language-javascript">const answer = 42;</code></pre>');
    expect((host.querySelector('[data-command="codeBlock"]') as HTMLButtonElement).getAttribute('aria-pressed')).toBe('true');

    editor.destroy();
  });

  it('inserts and edits a table from toolbar controls', () => {
    const host = document.createElement('div');
    const editor = createMoongladeEditor({
      element: host,
      content: '<p>Hello</p>'
    });

    (host.querySelector('[data-command="insertTable"]') as HTMLButtonElement).click();
    expect(editor.getHTML()).toContain('<table>');
    expect(editor.getHTML().match(/<tr>/g)).toHaveLength(3);
    expect(editor.getHTML().match(/<td>/g)).toHaveLength(9);

    (host.querySelector('[data-command="addTableRow"]') as HTMLButtonElement).click();
    expect(editor.getHTML().match(/<tr>/g)).toHaveLength(4);

    (host.querySelector('[data-command="toggleTableHeaderRow"]') as HTMLButtonElement).click();
    expect(editor.getHTML()).toContain('<th>');

    editor.destroy();
  });

  it('edits source HTML through the sanitizer-backed source dialog', () => {
    const host = document.createElement('div');
    const editor = createMoongladeEditor({
      element: host,
      content: '<p>Hello</p>'
    });

    (host.querySelector('[data-command="htmlSource"]') as HTMLButtonElement).click();

    const dialog = host.querySelector('.mg-editor-source-dialog') as HTMLDivElement;
    const form = dialog.querySelector('form') as HTMLFormElement;
    const sourceTextarea = dialog.querySelector('[name="source"]') as HTMLTextAreaElement;

    expect(dialog.hidden).toBe(false);

    sourceTextarea.value = '<p onclick="alert(1)">Clean <a href="javascript:alert(1)">link</a></p>';
    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));

    expect(dialog.hidden).toBe(true);
    expect(editor.getHTML()).toBe('<p>Clean link</p>');

    editor.destroy();
  });

  it('rejects unsafe image command URLs', () => {
    const host = document.createElement('div');
    const editor = createMoongladeEditor({
      element: host,
      content: '<p>Hello</p>'
    });

    expect(editor.run(editor.commands.insertImage('javascript:alert(1)', 'Bad'))).toBe(false);
    expect(editor.getHTML()).toBe('<p>Hello</p>');

    editor.destroy();
  });

  it('uploads and inserts an image using the configured upload URL', async () => {
    const file = new File(['fake-image'], 'photo.jpg', { type: 'image/jpeg' });
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.method).toBe('POST');
      expect(init.credentials).toBe('same-origin');
      expect(init.body).toBeInstanceOf(FormData);
      expect(((init.body as FormData).get('file') as File).name).toBe(file.name);

      return new Response(JSON.stringify({ location: '/media/photo.jpg', filename: 'photo.jpg' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const host = document.createElement('div');
    const editor = createMoongladeEditor({
      element: host,
      content: '<p>Hello</p>',
      uploadUrl: '/image'
    });

    editor.run((state, dispatch) => {
      dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, 6)));
      return true;
    });

    (host.querySelector('[data-command="image"]') as HTMLButtonElement).click();
    const input = host.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file]
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));

    await waitForExpectation(() => {
      expect(editor.getHTML()).toContain('<img');
    });

    expect(fetchMock).toHaveBeenCalledWith('/image', expect.any(Object));
    expect(editor.getHTML()).toBe('<p>Hello<img src="/media/photo.jpg" alt="photo.jpg" loading="lazy"></p>');
    expect((host.querySelector('.mg-editor-upload-status') as HTMLDivElement).hidden).toBe(true);

    editor.destroy();
  });

  it('shows an upload error when the image response is unsafe', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ location: 'javascript:alert(1)' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })));

    const host = document.createElement('div');
    const editor = createMoongladeEditor({
      element: host,
      content: '<p>Hello</p>',
      uploadUrl: '/image'
    });
    const file = new File(['fake-image'], 'bad.jpg', { type: 'image/jpeg' });
    const input = host.querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file]
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));

    await waitForAsyncWork();

    const uploadStatus = host.querySelector('.mg-editor-upload-status') as HTMLDivElement;
    expect(editor.getHTML()).toBe('<p>Hello</p>');
    expect(uploadStatus.hidden).toBe(false);
    expect(uploadStatus.textContent).toContain('safe image URL');

    editor.destroy();
  });
});
