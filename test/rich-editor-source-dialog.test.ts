import { describe, expect, it } from 'vitest';
import { createMoongladeEditor } from '../src/editor';
import { getSourceDialog, installRichEditorTestEnvironment, waitForExpectation } from './rich-editor-test-helpers';

installRichEditorTestEnvironment();

describe('rich editor source dialog', () => {
  it('edits source HTML through the sanitizer-backed source dialog', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const editor = createMoongladeEditor({
      element: host,
      content: '<p>Hello</p>'
    });

    (host.querySelector('[data-command="htmlSource"]') as HTMLButtonElement).click();

    const dialog = host.querySelector('.mg-editor-source-dialog') as HTMLDivElement;
    const form = dialog.querySelector('form') as HTMLFormElement;

    await waitForExpectation(() => {
      expect(dialog.querySelector('.mg-editor-source-code-editor .cm-editor')).not.toBeNull();
    });

    expect(dialog.hidden).toBe(false);
    expect(dialog.classList.contains('dropdown-menu')).toBe(false);
    expect(dialog.querySelector('.mg-editor-source-panel')).not.toBeNull();
    expect(dialog.querySelector('.mg-editor-source-code-editor .cm-editor')).not.toBeNull();
    expect(dialog.querySelector('.mg-editor-source-code-editor .cm-content')).toBe(document.activeElement);
    expect(dialog.querySelector('[name="source"]')).toBeNull();
    expect(getSourceDialog(editor).getValue()).toBe('<p>Hello</p>');

    await getSourceDialog(editor).setValue('<p onclick="alert(1)">Clean <a href="javascript:alert(1)">link</a></p>');
    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));

    expect(dialog.hidden).toBe(true);
    expect(editor.getHTML()).toBe('<p>Clean link</p>');
    expect(document.activeElement).toBe(editor.dom);

    editor.destroy();
  });

  it('opens find and replace controls in the highlighted source editor', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const editor = createMoongladeEditor({
      element: host,
      content: '<blockquote><p>Hello</p></blockquote><p>World</p>'
    });

    (host.querySelector('[data-command="htmlSource"]') as HTMLButtonElement).click();

    const dialog = host.querySelector('.mg-editor-source-dialog') as HTMLDivElement;
    const findButton = dialog.querySelector('[data-command="sourceFind"]') as HTMLButtonElement;
    const replaceButton = dialog.querySelector('[data-command="sourceReplace"]') as HTMLButtonElement;

    await waitForExpectation(() => {
      expect(dialog.querySelector('.mg-editor-source-code-editor')).not.toBeNull();
    });

    const codeEditor = dialog.querySelector('.mg-editor-source-code-editor') as HTMLDivElement;

    expect(codeEditor.querySelector('.cm-lineNumbers')).not.toBeNull();
    expect(codeEditor.querySelector('.cm-foldGutter')).not.toBeNull();
    expect(codeEditor.querySelector('.cm-content')?.textContent).toContain('<blockquote>');

    findButton.click();

    await waitForExpectation(() => {
      expect(codeEditor.querySelector('.cm-search')).not.toBeNull();
    });

    let searchPanel = codeEditor.querySelector('.cm-search') as HTMLElement;
    expect(searchPanel.querySelector('input[name="search"]')).not.toBeNull();
    expect(searchPanel.querySelector('input[name="replace"]')).not.toBeNull();

    replaceButton.click();

    searchPanel = codeEditor.querySelector('.cm-search') as HTMLElement;
    expect(searchPanel.querySelector('input[name="replace"]')).not.toBeNull();

    editor.destroy();
  });

  it('preserves custom classes edited in source HTML', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const editor = createMoongladeEditor({
      element: host,
      content: '<table><tbody><tr><td>Value</td></tr></tbody></table><ul><li><p>Item</p></li></ul>'
    });

    (host.querySelector('[data-command="htmlSource"]') as HTMLButtonElement).click();

    const dialog = host.querySelector('.mg-editor-source-dialog') as HTMLDivElement;
    const form = dialog.querySelector('form') as HTMLFormElement;

    await waitForExpectation(() => {
      expect(dialog.querySelector('.mg-editor-source-code-editor .cm-editor')).not.toBeNull();
    });

    await getSourceDialog(editor).setValue(
      getSourceDialog(editor)
        .getValue()
        .replace('<table>', '<table class="custom-table">')
        .replace('<ul>', '<ul class="abc">')
    );
    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));

    (host.querySelector('[data-command="htmlSource"]') as HTMLButtonElement).click();

    await waitForExpectation(() => {
      expect(getSourceDialog(editor).getValue()).toContain('<table class="custom-table">');
    });

    expect(getSourceDialog(editor).getValue()).toContain('<table class="custom-table">');
    expect(getSourceDialog(editor).getValue()).toContain('<ul class="abc">');

    editor.destroy();
  });

  it('closes the source dialog with Escape and returns focus to the editor', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const editor = createMoongladeEditor({
      element: host,
      content: '<p>Hello</p>'
    });

    (host.querySelector('[data-command="htmlSource"]') as HTMLButtonElement).click();

    const dialog = host.querySelector('.mg-editor-source-dialog') as HTMLDivElement;

    await waitForExpectation(() => {
      expect(dialog.querySelector('.mg-editor-source-code-editor .cm-content')).toBe(document.activeElement);
    });

    expect(dialog.hidden).toBe(false);
    expect(dialog.querySelector('.mg-editor-source-code-editor .cm-content')).toBe(document.activeElement);

    (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

    expect(dialog.hidden).toBe(true);
    expect(document.activeElement).toBe(editor.dom);

    editor.destroy();
  });

});
