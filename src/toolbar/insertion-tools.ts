import { createButtonGroup, createToolbarButton } from './dom';
import type { ToolbarContext } from './types';

export interface InsertionToolElements {
  group: HTMLDivElement;
}

export function createInsertionTools(context: ToolbarContext): InsertionToolElements {
  const group = createButtonGroup();

  const imageButton = createToolbarButton('image', 'image', 'Upload image');
  imageButton.disabled = !context.uploadConfigured;
  imageButton.addEventListener('click', () => context.actions.openImageDialog());
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

  group.append(imageButton, linkButton, codeButton, horizontalRuleButton);

  return { group };
}
