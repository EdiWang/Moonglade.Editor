import { describe, expect, it, vi } from 'vitest';
import { TextSelection } from 'prosemirror-state';
import { createMoongladeEditor } from '../src/editor';
import { createClipboardImagePasteEvent, installRichEditorTestEnvironment, waitForAsyncWork, waitForExpectation } from './rich-editor-test-helpers';

installRichEditorTestEnvironment();

describe('rich editor image upload', () => {
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

  it('does not insert a pending uploaded image after destroy', async () => {
    const file = new File(['fake-image'], 'delayed.jpg', { type: 'image/jpeg' });
    let resolveUpload: (result: { src: string; alt?: string }) => void = () => {};
    const uploadImage = vi.fn((uploadedFile: File) => {
      expect(uploadedFile).toBe(file);
      return new Promise<{ src: string; alt?: string }>((resolve) => {
        resolveUpload = resolve;
      });
    });
    const onChange = vi.fn();

    const host = document.createElement('div');
    const editor = createMoongladeEditor({
      element: host,
      content: '<p>Hello</p>',
      uploadImage,
      onChange
    });
    const input = host.querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file]
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));

    await waitForExpectation(() => {
      expect(uploadImage).toHaveBeenCalledWith(file);
    });

    editor.destroy();
    resolveUpload({ src: '/media/delayed.jpg', alt: 'Delayed' });
    await waitForAsyncWork();

    expect(host.querySelector('img[src="/media/delayed.jpg"]')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('uploads pasted clipboard image items with a temporary editor preview', async () => {
    const file = new File(['fake-image'], '', { type: 'image/png' });
    let resolveUpload: (result: { src: string; alt?: string }) => void = () => {};
    const uploadImage = vi.fn((uploadedFile: File) => {
      expect(uploadedFile).toBe(file);
      return new Promise<{ src: string; alt?: string }>((resolve) => {
        resolveUpload = resolve;
      });
    });
    const createObjectURL = vi.fn(() => 'blob:preview');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL,
      revokeObjectURL
    });

    const host = document.createElement('div');
    const editor = createMoongladeEditor({
      element: host,
      content: '<p>Hello</p>',
      uploadImage
    });

    editor.run((state, dispatch) => {
      dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, 6)));
      return true;
    });

    const event = createClipboardImagePasteEvent(file);
    editor.dom.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(uploadImage).toHaveBeenCalledWith(file);
    expect(createObjectURL).toHaveBeenCalledWith(file);
    expect((host.querySelector('.mg-editor-upload-preview img') as HTMLImageElement).getAttribute('src')).toBe('blob:preview');
    expect(editor.getHTML()).toBe('<p>Hello</p>');

    resolveUpload({ src: '/media/pasted.png', alt: 'Pasted' });

    await waitForExpectation(() => {
      expect(editor.getHTML()).toContain('<img');
    });

    expect(editor.getHTML()).toBe('<p>Hello<img src="/media/pasted.png" alt="Pasted" loading="lazy"></p>');
    expect(host.querySelector('.mg-editor-upload-preview')).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview');

    editor.destroy();
  });

  it('uploads pasted images from the toolbar image dialog', async () => {
    const file = new File(['fake-image'], 'dialog.png', { type: 'image/png' });
    const uploadImage = vi.fn(async (uploadedFile: File) => {
      expect(uploadedFile).toBe(file);
      return {
        src: '/media/dialog.png',
        alt: 'Dialog paste'
      };
    });

    const host = document.createElement('div');
    document.body.append(host);
    const editor = createMoongladeEditor({
      element: host,
      content: '<p>Hello</p>',
      uploadImage
    });

    editor.run((state, dispatch) => {
      dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, 6)));
      return true;
    });

    (host.querySelector('[data-command="image"]') as HTMLButtonElement).click();

    const dialog = host.querySelector('.mg-editor-image-dialog') as HTMLDivElement;
    const pasteTarget = dialog.querySelector('.mg-editor-image-paste-target') as HTMLDivElement;

    expect(dialog.hidden).toBe(false);
    expect(document.activeElement).toBe(pasteTarget);

    const event = createClipboardImagePasteEvent(file);
    pasteTarget.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(dialog.hidden).toBe(true);

    await waitForExpectation(() => {
      expect(uploadImage).toHaveBeenCalledWith(file);
      expect(editor.getHTML()).toContain('<img');
    });

    expect(editor.getHTML()).toBe('<p>Hello<img src="/media/dialog.png" alt="Dialog paste" loading="lazy"></p>');

    editor.destroy();
  });

  it('ignores unsupported image upload extensions by default', () => {
    const uploadImage = vi.fn(async () => ({
      src: '/media/animation.gif'
    }));

    const host = document.createElement('div');
    const editor = createMoongladeEditor({
      element: host,
      content: '<p>Hello</p>',
      uploadImage
    });
    const file = new File(['fake-image'], 'animation.gif', { type: 'image/gif' });
    const input = host.querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file]
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));

    const uploadStatus = host.querySelector('.mg-editor-upload-status') as HTMLDivElement;
    expect(uploadImage).not.toHaveBeenCalled();
    expect(editor.getHTML()).toBe('<p>Hello</p>');
    expect(uploadStatus.hidden).toBe(true);
    expect(uploadStatus.textContent).toBe('');

    editor.destroy();
  });

  it('uploads the first allowed image when earlier files are unsupported', async () => {
    const unsupportedFile = new File(['fake-image'], 'animation.gif', { type: 'image/gif' });
    const allowedFile = new File(['fake-image'], 'photo.png', { type: 'image/png' });
    const uploadImage = vi.fn(async (uploadedFile: File) => {
      expect(uploadedFile).toBe(allowedFile);
      return {
        src: '/media/photo.png',
        alt: 'Photo'
      };
    });

    const host = document.createElement('div');
    const editor = createMoongladeEditor({
      element: host,
      content: '<p>Hello</p>',
      uploadImage
    });
    const input = host.querySelector('input[type="file"]') as HTMLInputElement;

    editor.run((state, dispatch) => {
      dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, 6)));
      return true;
    });

    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [unsupportedFile, allowedFile]
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));

    await waitForExpectation(() => {
      expect(uploadImage).toHaveBeenCalledWith(allowedFile);
      expect(editor.getHTML()).toContain('<img');
    });

    expect(uploadImage).toHaveBeenCalledTimes(1);
    expect(editor.getHTML()).toBe('<p>Hello<img src="/media/photo.png" alt="Photo" loading="lazy"></p>');

    editor.destroy();
  });

  it('uses custom image upload extensions for picker filtering and upload validation', async () => {
    const file = new File(['fake-image'], 'animation.GIF', { type: 'image/gif' });
    const uploadImage = vi.fn(async (uploadedFile: File) => {
      expect(uploadedFile).toBe(file);
      return {
        src: '/media/animation.gif',
        alt: 'Animation'
      };
    });

    const host = document.createElement('div');
    const editor = createMoongladeEditor({
      element: host,
      content: '<p>Hello</p>',
      uploadImage,
      allowedImageExtensions: ['gif']
    });
    const input = host.querySelector('input[type="file"]') as HTMLInputElement;

    expect(input.accept).toBe('.gif');

    editor.run((state, dispatch) => {
      dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, 6)));
      return true;
    });

    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file]
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));

    await waitForExpectation(() => {
      expect(uploadImage).toHaveBeenCalledWith(file);
      expect(editor.getHTML()).toContain('<img');
    });

    expect(editor.getHTML()).toBe('<p>Hello<img src="/media/animation.gif" alt="Animation" loading="lazy"></p>');

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
  });});
