import { createCommandButtonGroup } from './dom';
import type { ToolbarContext } from './types';

export function createAlignmentTools(context: ToolbarContext): HTMLDivElement {
  return createCommandButtonGroup(context, [
    ['alignLeft', 'text-left', 'Align left', context.commands.alignment('left')],
    ['alignCenter', 'text-center', 'Align center', context.commands.alignment('center')],
    ['alignRight', 'text-right', 'Align right', context.commands.alignment('right')],
    ['alignJustify', 'justify', 'Justify text', context.commands.alignment('justify')]
  ]);
}
