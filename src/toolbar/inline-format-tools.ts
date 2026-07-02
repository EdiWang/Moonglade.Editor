import { createCommandButtonGroup } from './dom';
import type { ToolbarContext } from './types';

export function createInlineFormatTools(context: ToolbarContext): HTMLDivElement {
  return createCommandButtonGroup(context, [
    ['bold', 'type-bold', 'Bold', context.commands.bold],
    ['italic', 'type-italic', 'Italic', context.commands.italic],
    ['underline', 'type-underline', 'Underline', context.commands.underline],
    ['strike', 'type-strikethrough', 'Strikethrough', context.commands.strike]
  ]);
}
