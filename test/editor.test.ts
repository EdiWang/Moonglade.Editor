import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TextSelection } from 'prosemirror-state';
import { createMoongladeEditor } from '../src/editor';

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
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
  it('uses a 500px editor height by default', () => {
    const host = document.createElement('div');
    const editor = createMoongladeEditor({
      element: host,
      content: '<p>Hello</p>'
    });

    expect(host.style.height).toBe('500px');

    editor.destroy();
  });

  it('honors custom CSS editor height values', () => {
    const host = document.createElement('div');
    const editor = createMoongladeEditor({
      element: host,
      content: '<p>Hello</p>',
      height: 'calc(100vh - 12rem)'
    });

    expect(host.style.height).toBe('calc(100vh - 12rem)');

    editor.destroy();
  });

  it('keeps the editor shell vertically resizable', () => {
    const css = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8');
    const editorRule = css.match(/\.mg-editor\s*\{[^}]+\}/)?.[0] ?? '';

    expect(editorRule).toContain('resize: vertical;');
    expect(editorRule).toContain('overflow: hidden;');
  });

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
  });

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
    expect(host.querySelector('[data-command="text_color"]')?.classList.contains('mg-editor-color-trigger')).toBe(true);
    expect(host.querySelector('[data-command="background_color"]')?.classList.contains('mg-editor-color-trigger')).toBe(true);
    expect(host.querySelector('.mg-editor-color-group [data-command="text_color"]')).not.toBeNull();
    expect(host.querySelector('.mg-editor-color-group [data-command="background_color"]')).not.toBeNull();
    expect(host.querySelector('[data-command="text_color:#0d6efd"]')?.classList.contains('mg-editor-color-swatch')).toBe(true);
    expect(host.querySelector('[data-command="text_color:clear"] .mg-editor-no-color')).not.toBeNull();
    expect(host.querySelector('[data-command="removeLink"]')).toBeNull();
    expect(host.querySelector('[data-command="insertTable"]')?.closest('.btn-group')).toBe(host.querySelector('[data-command="addTableRow"]')?.closest('.btn-group'));
    expect(host.querySelector('[data-command="insertTable"]')?.closest('.btn-group')).toBe(host.querySelector('[data-command="deleteTable"]')?.closest('.btn-group'));
    expect(host.querySelector('[data-command="horizontalRule"] .bi-hr')).not.toBeNull();
    expect(host.querySelector('.mg-editor-dialog')?.classList.contains('dropdown-menu')).toBe(true);
    expect(host.querySelector('[data-command="bold"]')).not.toBeNull();
    expect(host.querySelector('[data-command="undo"]')).not.toBeNull();

    const toolbar = host.querySelector('[role="toolbar"]') as HTMLElement;
    expect(toolbar.children[0].querySelector('[data-command="undo"]')).not.toBeNull();
    expect(toolbar.children[0].querySelector('[data-command="redo"]')).not.toBeNull();
    expect(toolbar.children[1].querySelector('.mg-editor-format')).not.toBeNull();

    const inlineFormatGroup = host.querySelector('[data-command="strike"]')?.closest('.btn-group') as HTMLElement;
    const colorGroup = inlineFormatGroup.nextElementSibling as HTMLElement;
    expect(colorGroup.classList.contains('mg-editor-color-group')).toBe(true);
    expect(colorGroup.querySelector('[data-command="text_color"]')).not.toBeNull();

    const alignGroup = host.querySelector('[data-command="alignJustify"]')?.closest('.btn-group') as HTMLElement;
    const insertCommands = Array.from(alignGroup.nextElementSibling?.querySelectorAll('button[data-command]') ?? [])
      .map((button) => button.getAttribute('data-command'));
    expect(insertCommands).toEqual(['image', 'link', 'codeBlock', 'horizontalRule']);

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

    expect(editor.getHTML()).toBe(`<blockquote>
  <p>Hello</p>
</blockquote>`);
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

  it('closes the link dialog with Escape and returns focus to the editor', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const editor = createMoongladeEditor({
      element: host,
      content: '<p>Hello world</p>'
    });

    editor.run((state, dispatch) => {
      dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, 1, 6)));
      return true;
    });

    (host.querySelector('[data-command="link"]') as HTMLButtonElement).click();

    const dialog = host.querySelector('.mg-editor-dialog[aria-label="Link"]') as HTMLDivElement;
    const hrefInput = dialog.querySelector('[name="href"]') as HTMLInputElement;

    expect(dialog.hidden).toBe(false);
    expect(document.activeElement).toBe(hrefInput);

    hrefInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

    expect(dialog.hidden).toBe(true);
    expect(document.activeElement).toBe(editor.dom);

    editor.destroy();
  });

  it('applies foreground and background colors from toolbar dropdowns', () => {
    const host = document.createElement('div');
    const editor = createMoongladeEditor({
      element: host,
      content: '<p>Hello</p>'
    });

    editor.run((state, dispatch) => {
      dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, 1, 6)));
      return true;
    });

    const textColorButton = host.querySelector('[data-command="text_color"]') as HTMLButtonElement;
    textColorButton.click();
    expect(textColorButton.getAttribute('aria-expanded')).toBe('true');

    const blueButton = host.querySelector('[data-command="text_color:#0d6efd"]') as HTMLButtonElement;
    blueButton.click();

    expect(editor.getHTML()).toBe('<p><span style="color: rgb(13, 110, 253);">Hello</span></p>');
    expect(textColorButton.getAttribute('aria-pressed')).toBe('true');
    expect(blueButton.classList.contains('active')).toBe(true);

    editor.run((state, dispatch) => {
      dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, 1, 6)));
      return true;
    });
    const backgroundColorButton = host.querySelector('[data-command="background_color"]') as HTMLButtonElement;
    backgroundColorButton.click();
    expect(backgroundColorButton.getAttribute('aria-expanded')).toBe('true');

    const yellowButton = host.querySelector('[data-command="background_color:#ffc107"]') as HTMLButtonElement;
    yellowButton.click();

    expect(editor.getHTML()).toBe('<p><span style="color: rgb(13, 110, 253);"><span style="background-color: rgb(255, 193, 7);">Hello</span></span></p>');
    expect(backgroundColorButton.getAttribute('aria-pressed')).toBe('true');
    expect(yellowButton.classList.contains('active')).toBe(true);

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

  it('closes the code dialog with Escape and returns focus to the editor', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const editor = createMoongladeEditor({
      element: host,
      content: '<p>const answer = 42;</p>'
    });

    (host.querySelector('[data-command="codeBlock"]') as HTMLButtonElement).click();

    const dialog = host.querySelector('.mg-editor-dialog[aria-label="Code snippet"]') as HTMLDivElement;
    const languageSelect = dialog.querySelector('[name="language"]') as HTMLSelectElement;

    expect(dialog.hidden).toBe(false);
    expect(document.activeElement).toBe(languageSelect);

    languageSelect.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

    expect(dialog.hidden).toBe(true);
    expect(document.activeElement).toBe(editor.dom);

    editor.destroy();
  });

  it('inserts a horizontal rule from the toolbar', () => {
    const host = document.createElement('div');
    const editor = createMoongladeEditor({
      element: host,
      content: '<p>Hello</p>'
    });

    editor.run((state, dispatch) => {
      dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, 6)));
      return true;
    });

    const horizontalRuleButton = host.querySelector('[data-command="horizontalRule"]') as HTMLButtonElement;
    horizontalRuleButton.click();

    expect(editor.getHTML()).toBe(`<p>Hello</p>
<hr>`);
    expect(horizontalRuleButton.disabled).toBe(false);

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
    document.body.append(host);
    const editor = createMoongladeEditor({
      element: host,
      content: '<p>Hello</p>'
    });

    (host.querySelector('[data-command="htmlSource"]') as HTMLButtonElement).click();

    const dialog = host.querySelector('.mg-editor-source-dialog') as HTMLDivElement;
    const form = dialog.querySelector('form') as HTMLFormElement;
    const sourceTextarea = dialog.querySelector('[name="source"]') as HTMLTextAreaElement;

    expect(dialog.hidden).toBe(false);
    expect(dialog.classList.contains('dropdown-menu')).toBe(false);
    expect(dialog.querySelector('.mg-editor-source-panel')).not.toBeNull();

    sourceTextarea.value = '<p onclick="alert(1)">Clean <a href="javascript:alert(1)">link</a></p>';
    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));

    expect(dialog.hidden).toBe(true);
    expect(editor.getHTML()).toBe('<p>Clean link</p>');
    expect(document.activeElement).toBe(editor.dom);

    editor.destroy();
  });

  it('closes the source dialog with Escape and returns focus to the editor', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const editor = createMoongladeEditor({
      element: host,
      content: '<p>Hello</p>'
    });

    (host.querySelector('[data-command="htmlSource"]') as HTMLButtonElement).click();

    const dialog = host.querySelector('.mg-editor-source-dialog') as HTMLDivElement;
    const sourceTextarea = dialog.querySelector('[name="source"]') as HTMLTextAreaElement;

    expect(dialog.hidden).toBe(false);
    expect(document.activeElement).toBe(sourceTextarea);

    sourceTextarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

    expect(dialog.hidden).toBe(true);
    expect(document.activeElement).toBe(editor.dom);

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

  it('uploads and inserts an image using a custom uploader', async () => {
    const file = new File(['fake-image'], 'custom.jpg', { type: 'image/jpeg' });
    const uploadImage = vi.fn(async (uploadedFile: File) => {
      expect(uploadedFile).toBe(file);
      return {
        src: '/media/custom.jpg',
        alt: 'Custom alt',
        title: 'Custom title'
      };
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const host = document.createElement('div');
    const editor = createMoongladeEditor({
      element: host,
      content: '<p>Hello</p>',
      uploadImage
    });

    const imageButton = host.querySelector('[data-command="image"]') as HTMLButtonElement;
    expect(imageButton.disabled).toBe(false);

    editor.run((state, dispatch) => {
      dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, 6)));
      return true;
    });

    imageButton.click();
    const input = host.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file]
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));

    await waitForExpectation(() => {
      expect(uploadImage).toHaveBeenCalledWith(file);
      expect(editor.getHTML()).toContain('<img');
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(editor.getHTML()).toBe('<p>Hello<img src="/media/custom.jpg" alt="Custom alt" title="Custom title" loading="lazy"></p>');

    editor.destroy();
  });

  it('inserts a delayed uploaded image at the original upload selection', async () => {
    const file = new File(['fake-image'], 'delayed.jpg', { type: 'image/jpeg' });
    let resolveUpload: (result: { src: string; alt?: string }) => void = () => {};
    const uploadImage = vi.fn((uploadedFile: File) => {
      expect(uploadedFile).toBe(file);
      return new Promise<{ src: string; alt?: string }>((resolve) => {
        resolveUpload = resolve;
      });
    });

    const host = document.createElement('div');
    const editor = createMoongladeEditor({
      element: host,
      content: '<p>Hello world</p>',
      uploadImage
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
      expect(uploadImage).toHaveBeenCalledWith(file);
    });

    editor.run((state, dispatch) => {
      dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, 7, 12)));
      return true;
    });
    (host.querySelector('[data-command="link"]') as HTMLButtonElement).click();

    resolveUpload({ src: '/media/delayed.jpg', alt: 'Delayed' });

    await waitForExpectation(() => {
      expect(editor.getHTML()).toContain('<img');
    });

    expect(editor.getHTML()).toBe('<p>Hello<img src="/media/delayed.jpg" alt="Delayed" loading="lazy"> world</p>');

    editor.destroy();
  });

  it.each([
    {
      name: 'HTTP failure',
      response: () => new Response(JSON.stringify({ error: 'nope' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }),
      message: 'Image upload failed with status 500.'
    },
    {
      name: 'invalid JSON',
      response: () => new Response('not-json', {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }),
      message: 'Image upload failed because the server returned invalid JSON.'
    },
    {
      name: 'missing image URL',
      response: () => new Response(JSON.stringify({ filename: 'missing.jpg' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }),
      message: 'Image upload response did not include an image URL.'
    }
  ])('shows a normalized upload error for $name', async ({ response, message }) => {
    vi.stubGlobal('fetch', vi.fn(async () => response()));

    const host = document.createElement('div');
    const editor = createMoongladeEditor({
      element: host,
      content: '<p>Hello</p>',
      uploadUrl: '/image'
    });
    const file = new File(['fake-image'], 'failed.jpg', { type: 'image/jpeg' });
    const input = host.querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file]
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));

    const uploadStatus = host.querySelector('.mg-editor-upload-status') as HTMLDivElement;
    await waitForExpectation(() => {
      expect(uploadStatus.hidden).toBe(false);
      expect(uploadStatus.textContent).toBe(message);
    });

    expect(editor.getHTML()).toBe('<p>Hello</p>');

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
