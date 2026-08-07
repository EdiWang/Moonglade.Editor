import { expect, test, type Locator } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/demo/', { waitUntil: 'domcontentloaded' });
});

test('rich HTML demo keeps focus, opens source dialog, and applies toolbar commands', async ({ page }) => {
  const editor = page.locator('.ProseMirror');

  await expect(editor).toBeFocused();

  const initialRuleCount = await editor.locator('hr').count();
  await page.getByRole('button', { name: 'Insert horizontal rule' }).click();
  await expect.poll(() => editor.locator('hr').count()).toBe(initialRuleCount + 1);

  await page.getByRole('button', { name: 'Edit HTML source' }).click();
  const sourceDialog = page.getByRole('dialog', { name: 'HTML source' });
  await expect(sourceDialog).toBeVisible();
  await expect(sourceDialog.locator('.cm-content')).toBeFocused();

  await sourceDialog
    .getByRole('textbox')
    .fill('<p onclick="alert(1)">Browser Clean <a href="javascript:alert(1)">link</a></p>');
  await sourceDialog.getByRole('button', { name: 'Save' }).click();

  await expect(sourceDialog).toBeHidden();
  await expect(editor).toBeFocused();
  await expect(editor).toHaveText('Browser Clean link');
  await expect.poll(() => editor.evaluate((element) => element.innerHTML)).toBe('<p>Browser Clean link</p>');
});

test('rich HTML demo uploads an image through the toolbar dialog', async ({ page }) => {
  const editor = page.locator('.ProseMirror');

  await expect(editor).toBeFocused();
  await page.getByRole('button', { name: 'Upload image' }).click();

  const imageDialog = page.getByRole('dialog', { name: 'Image upload' });
  await expect(imageDialog).toBeVisible();
  await expect(imageDialog.getByRole('button', { name: 'Paste image' })).toBeFocused();

  await imageDialog.locator('input[type="file"]').setInputFiles({
    name: 'rich-upload.png',
    mimeType: 'image/png',
    buffer: Buffer.from('fake-image')
  });

  await expect(imageDialog).toBeHidden();
  const image = editor.locator('img[alt="rich-upload.png"]');
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute('src', /\/uploads\/.+rich-upload\.png$/);
  await expect.poll(() => page.locator('#content').inputValue()).toContain('alt="rich-upload.png"');
});

test('Markdown demo uploads pasted and dropped images into Markdown syntax', async ({ page }) => {
  await page.getByRole('button', { name: 'Markdown' }).click();
  const editor = page.locator('.cm-content');
  const textarea = page.locator('#content');

  await expect(editor).toBeFocused();
  await editor.fill('');

  await dispatchImageTransfer(editor, 'paste', 'paste-one.png');
  await expect.poll(() => textarea.inputValue()).toContain('![paste-one.png](/uploads/');

  await dispatchImageTransfer(editor, 'drop', 'drop-one.png');
  await expect.poll(() => textarea.inputValue()).toContain('![drop-one.png](/uploads/');
});

async function dispatchImageTransfer(target: Locator, eventType: 'paste' | 'drop', fileName: string): Promise<void> {
  await target.evaluate((element, { eventType, fileName }) => {
    const file = new File(['fake-image'], fileName, { type: 'image/png' });
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);

    const event = eventType === 'paste'
      ? new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: dataTransfer
        })
      : new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          clientX: 24,
          clientY: 24,
          dataTransfer
        });

    element.dispatchEvent(event);
  }, { eventType, fileName });
}
