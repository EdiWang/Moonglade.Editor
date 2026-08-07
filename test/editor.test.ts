import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createMoongladeEditor } from '../src/editor';
import { installRichEditorTestEnvironment } from './rich-editor-test-helpers';

installRichEditorTestEnvironment();

describe('rich editor basics', () => {
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

  it('rejects invalid rich HTML editor options with clear errors', () => {
    const validOptions = (): Record<string, unknown> => ({
      element: document.createElement('div')
    });

    expect(() => createMoongladeEditor(null as unknown as Parameters<typeof createMoongladeEditor>[0]))
      .toThrow('Moonglade.Editor rich HTML editor options must be an object.');

    const cases: Array<{ name: string; options: Record<string, unknown>; message: string }> = [
      {
        name: 'element',
        options: {},
        message: 'Moonglade.Editor rich HTML editor element must be an HTMLElement.'
      },
      {
        name: 'textarea',
        options: { ...validOptions(), textarea: document.createElement('input') },
        message: 'Moonglade.Editor rich HTML editor textarea must be an HTMLTextAreaElement.'
      },
      {
        name: 'content',
        options: { ...validOptions(), content: 42 },
        message: 'Moonglade.Editor rich HTML editor content must be a string.'
      },
      {
        name: 'height',
        options: { ...validOptions(), height: 500 },
        message: 'Moonglade.Editor rich HTML editor height must be a string.'
      },
      {
        name: 'spellcheck',
        options: { ...validOptions(), spellcheck: 'true' },
        message: 'Moonglade.Editor rich HTML editor spellcheck must be a boolean.'
      },
      {
        name: 'uploadUrl',
        options: { ...validOptions(), uploadUrl: 123 },
        message: 'Moonglade.Editor rich HTML editor uploadUrl must be a string.'
      },
      {
        name: 'uploadImage',
        options: { ...validOptions(), uploadImage: '/image' },
        message: 'Moonglade.Editor rich HTML editor uploadImage must be a function.'
      },
      {
        name: 'allowedImageExtensions',
        options: { ...validOptions(), allowedImageExtensions: ['.jpg', 42] },
        message: 'Moonglade.Editor rich HTML editor allowedImageExtensions must be an array of strings.'
      },
      {
        name: 'codesample_languages',
        options: { ...validOptions(), codesample_languages: [{ text: 'TypeScript' }] },
        message: 'Moonglade.Editor rich HTML editor codesample_languages must be an array of code sample language options.'
      },
      {
        name: 'onChange',
        options: { ...validOptions(), onChange: true },
        message: 'Moonglade.Editor rich HTML editor onChange must be a function.'
      }
    ];

    for (const { name, options, message } of cases) {
      expect(
        () => createMoongladeEditor(options as unknown as Parameters<typeof createMoongladeEditor>[0]),
        name
      ).toThrow(message);
    }
  });

  it('keeps the editor shell vertically resizable', () => {
    const css = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8');
    const editorRule = css.match(/\.mg-editor\s*\{[^}]+\}/)?.[0] ?? '';

    expect(editorRule).toContain('resize: vertical;');
    expect(editorRule).toContain('overflow: hidden;');
  });

});
