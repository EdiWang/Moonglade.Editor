import { createButtonGroup, createToolbarButton } from './dom';
import type { ToolbarContext } from './types';

export function createSourceTool(context: ToolbarContext): HTMLDivElement {
  const sourceGroup = createButtonGroup();
  const sourceButton = createToolbarButton('htmlSource', 'filetype-html', 'Edit HTML source');
  sourceButton.addEventListener('click', () => context.actions.openSourceDialog());
  context.buttons.htmlSource = sourceButton;
  sourceGroup.append(sourceButton);
  return sourceGroup;
}
