import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { TextSelection } from 'prosemirror-state';
import { createMoongladeEditor } from '../src/editor';
import { installRichEditorTestEnvironment, mockElementRect } from './rich-editor-test-helpers';

installRichEditorTestEnvironment();

describe('rich editor toolbar', () => {
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
    expect(host.querySelector('[data-command="bold"]')?.getAttribute('title')).toBe('Bold (Ctrl+B)');
    expect(host.querySelector('[data-command="bold"]')?.getAttribute('aria-keyshortcuts')).toBe('Control+B Meta+B');
    expect(host.querySelector('[data-command="bold"] .bi-type-bold')).not.toBeNull();
    expect(host.querySelector('[data-command="undo"] .bi-arrow-counterclockwise')).not.toBeNull();
    expect(host.querySelector('[data-command="text_color"]')?.classList.contains('mg-editor-color-trigger')).toBe(true);
    expect(host.querySelector('[data-command="background_color"]')?.classList.contains('mg-editor-color-trigger')).toBe(true);
    expect(host.querySelector('.mg-editor-color-group [data-command="text_color"]')).not.toBeNull();
    expect(host.querySelector('.mg-editor-color-group [data-command="background_color"]')).not.toBeNull();
    expect(host.querySelector('[data-command="text_color:#0d6efd"]')?.classList.contains('mg-editor-color-swatch')).toBe(true);
    expect(host.querySelector('[data-command="text_color:clear"] .mg-editor-no-color')).not.toBeNull();
    expect(host.querySelector('[data-command="removeLink"]')).toBeNull();
    expect(host.querySelector('[data-command="insertTable"]')?.classList.contains('mg-editor-table-trigger')).toBe(true);
    expect(host.querySelector('[data-command="insertTable"]')?.querySelector('.bi-chevron-down')).not.toBeNull();
    expect(host.querySelector('.mg-editor-table-menu')?.classList.contains('dropdown-menu')).toBe(true);
    expect(host.querySelector('[data-command="addTableRow"]')?.closest('.mg-editor-table-menu')).not.toBeNull();
    expect(host.querySelector('[data-command="deleteTable"]')?.closest('.mg-editor-table-menu')).not.toBeNull();
    expect(host.querySelector('[data-command="insertTable:5x3"]')?.classList.contains('mg-editor-table-grid-cell')).toBe(true);
    expect(host.querySelector('[data-command="horizontalRule"] .bi-hr')).not.toBeNull();
    expect(host.querySelector('.mg-editor-dialog')?.classList.contains('dropdown-menu')).toBe(true);
    expect(host.querySelector('[data-command="bold"]')).not.toBeNull();
    expect(host.querySelector('[data-command="undo"]')).not.toBeNull();
    expect((host.querySelector('input[type="file"]') as HTMLInputElement).accept).toBe('.jpg,.png,.webp,.svg');

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

  it('keeps titles available on disabled toolbar buttons', () => {
    const css = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8');
    const disabledTitleRule = css.match(/\.mg-editor button:disabled\[title\]\s*\{[^}]+\}/)?.[0] ?? '';
    const disabledTitleChildRule = css.match(/\.mg-editor button:disabled\[title\] > \*\s*\{[^}]+\}/)?.[0] ?? '';
    const host = document.createElement('div');
    const editor = createMoongladeEditor({
      element: host,
      content: '<p>Hello</p>'
    });
    const imageButton = host.querySelector('[data-command="image"]') as HTMLButtonElement;
    const imageIcon = imageButton.querySelector('.bi') as HTMLElement;
    const imageDialog = host.querySelector('.mg-editor-image-dialog') as HTMLDivElement;

    expect(imageButton.disabled).toBe(true);
    expect(imageButton.title).toBe('Upload image');
    expect(disabledTitleRule).toContain('pointer-events: auto;');
    expect(disabledTitleChildRule).toContain('pointer-events: none;');
    expect(imageIcon.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))).toBe(false);
    expect(imageDialog.hidden).toBe(true);

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

    expect(editor.getHTML()).toBe('<p class="text-center">Hello</p>');
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
    expect((host.querySelector('.ProseMirror pre') as HTMLPreElement).getAttribute('spellcheck')).toBe('false');
    expect((host.querySelector('[data-command="codeBlock"]') as HTMLButtonElement).getAttribute('aria-pressed')).toBe('true');

    editor.destroy();
  });

  it('wraps selected text in inline code from the insert code toolbar button', () => {
    const host = document.createElement('div');
    const editor = createMoongladeEditor({
      element: host,
      content: '<p>Hello world</p>'
    });

    editor.run((state, dispatch) => {
      dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, 1, 6)));
      return true;
    });

    const codeButton = host.querySelector('[data-command="codeBlock"]') as HTMLButtonElement;
    codeButton.click();

    const dialog = host.querySelector('.mg-editor-dialog[aria-label="Code snippet"]') as HTMLDivElement;

    expect(dialog.hidden).toBe(true);
    expect(editor.getHTML()).toBe('<p><code>Hello</code> world</p>');
    expect(codeButton.getAttribute('aria-pressed')).toBe('true');

    editor.destroy();
  });

  it('uses configured code sample languages in the toolbar dialog', () => {
    const host = document.createElement('div');
    const editor = createMoongladeEditor({
      element: host,
      content: '<p>param appName string</p>',
      codesample_languages: [
        { text: ' Bicep ', value: ' Bicep ' },
        { text: 'Kusto', value: 'kusto' },
        { text: 'Unsafe', value: 'javascript:alert(1)' },
        { text: '', value: 'typescript' }
      ]
    });

    (host.querySelector('[data-command="codeBlock"]') as HTMLButtonElement).click();

    const dialog = host.querySelector('.mg-editor-dialog[aria-label="Code snippet"]') as HTMLDivElement;
    const form = dialog.querySelector('form') as HTMLFormElement;
    const languageSelect = dialog.querySelector('[name="language"]') as HTMLSelectElement;
    const options = Array.from(languageSelect.options).map((option) => ({
      text: option.textContent,
      value: option.value
    }));

    expect(options).toEqual([
      { text: 'Bicep', value: 'bicep' },
      { text: 'Kusto', value: 'kusto' }
    ]);

    languageSelect.value = 'bicep';
    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));

    expect(editor.getHTML()).toBe('<pre><code class="language-bicep">param appName string</code></pre>');

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

    const tableButton = host.querySelector('[data-command="insertTable"]') as HTMLButtonElement;
    const tableMenu = host.querySelector('.mg-editor-table-menu') as HTMLDivElement;
    const tableSizeLabel = host.querySelector('.mg-editor-table-size-label') as HTMLSpanElement;

    tableButton.click();
    expect(tableMenu.hidden).toBe(false);
    expect(tableButton.getAttribute('aria-expanded')).toBe('true');

    const fiveByThreeButton = host.querySelector('[data-command="insertTable:5x3"]') as HTMLButtonElement;
    fiveByThreeButton.dispatchEvent(new Event('pointerenter', { bubbles: true }));
    expect(tableSizeLabel.textContent).toBe('5x3');
    fiveByThreeButton.click();

    expect(tableMenu.hidden).toBe(true);
    expect(editor.getHTML()).toContain('<table>');
    expect(editor.getHTML().match(/<tr>/g)).toHaveLength(3);
    expect(editor.getHTML().match(/<td>/g)).toHaveLength(15);

    tableButton.click();
    (host.querySelector('[data-table-panel="row"]') as HTMLButtonElement).click();
    expect((host.querySelector('[data-panel="row"]') as HTMLDivElement).hidden).toBe(false);
    (host.querySelector('[data-command="addTableRow"]') as HTMLButtonElement).click();
    expect(editor.getHTML().match(/<tr>/g)).toHaveLength(4);

    tableButton.click();
    (host.querySelector('[data-command="toggleTableHeaderRow"]') as HTMLButtonElement).click();
    expect(editor.getHTML()).toContain('<th>');

    editor.destroy();
  });

  it('keeps the table menu inside the editor when the toolbar wraps', () => {
    vi.stubGlobal('innerWidth', 932);
    const host = document.createElement('div');
    document.body.append(host);
    const editor = createMoongladeEditor({
      element: host,
      content: '<p>Hello</p>'
    });

    const tableDropdown = host.querySelector('.mg-editor-table-dropdown') as HTMLDivElement;
    const tableButton = host.querySelector('[data-command="insertTable"]') as HTMLButtonElement;
    const tableMenu = host.querySelector('.mg-editor-table-menu') as HTMLDivElement;

    mockElementRect(host, { left: 118, top: 72, width: 696, height: 672 });
    mockElementRect(tableDropdown, { left: 424.8, top: 120.5, width: 55.2, height: 32 });
    mockElementRect(tableMenu, { left: 424.8, top: 156.5, width: 416, height: 208.8 });

    tableButton.click();

    expect(tableMenu.hidden).toBe(false);
    expect(tableMenu.style.left).toBe('-27px');
    expect(tableMenu.style.right).toBe('auto');
    expect(tableMenu.style.maxWidth).toBe('696px');

    editor.destroy();
  });

});
