import { describe, expect, it } from 'vitest';
import { TextSelection } from 'prosemirror-state';
import { createMoongladeEditor } from '../src/editor';

describe('editor toolbar', () => {
  it('renders a framework-free toolbar shell', () => {
    const host = document.createElement('div');
    const editor = createMoongladeEditor({
      element: host,
      content: '<p>Hello</p>'
    });

    expect(host.classList.contains('mg-editor')).toBe(true);
    expect(host.querySelector('[role="toolbar"]')).not.toBeNull();
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
});
