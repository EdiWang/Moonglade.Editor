import { createButtonGroup, createToolbarButton } from './dom';
import { getFirstImageFile } from './image-files';
import type { ToolbarContext } from './types';

export interface InsertionToolElements {
  group: HTMLDivElement;
  imageInput: HTMLInputElement;
}

export function createInsertionTools(context: ToolbarContext): InsertionToolElements {
  const group = createButtonGroup();

  const imageButton = createToolbarButton('image', 'image', 'Upload image');
  const imageInput = document.createElement('input');
  imageInput.type = 'file';
  imageInput.accept = context.allowedImageExtensions.join(',');
  imageInput.hidden = true;
  imageButton.disabled = !context.uploadConfigured;
  imageButton.addEventListener('click', () => {
    context.actions.saveSelection();
    imageInput.click();
  });
  imageInput.addEventListener('change', () => {
    const file = getFirstImageFile(imageInput.files, context.allowedImageExtensions);
    imageInput.value = '';

    if (file) {
      context.actions.uploadFile(file);
    }
  });
  context.buttons.image = imageButton;

  const linkButton = createToolbarButton('link', 'link-45deg', 'Add or edit link');
  linkButton.addEventListener('click', () => context.actions.openLinkDialog());
  context.buttons.link = linkButton;

  const codeButton = createToolbarButton('codeBlock', 'code-slash', 'Code snippet');
  codeButton.addEventListener('click', () => context.actions.openCodeDialog());
  context.buttons.codeBlock = codeButton;

  const horizontalRuleButton = createToolbarButton('horizontalRule', 'hr', 'Insert horizontal rule');
  horizontalRuleButton.addEventListener('click', () => context.actions.execute(context.commands.insertHorizontalRule));
  context.buttons.horizontalRule = horizontalRuleButton;

  group.append(imageButton, imageInput, linkButton, codeButton, horizontalRuleButton);

  return { group, imageInput };
}
