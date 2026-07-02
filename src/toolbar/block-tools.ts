import { createCommandButtonGroup } from './dom';
import type { ToolbarContext } from './types';

export function createBlockTools(context: ToolbarContext): HTMLDivElement {
  return createCommandButtonGroup(context, [
    ['blockquote', 'quote', 'Blockquote', context.commands.blockquote],
    ['bulletList', 'list-ul', 'Bullet list', context.commands.bulletList],
    ['orderedList', 'list-ol', 'Numbered list', context.commands.orderedList]
  ]);
}
