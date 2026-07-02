import { createCommandButtonGroup } from './dom';
import type { ToolbarContext } from './types';

export function createHistoryTools(context: ToolbarContext): HTMLDivElement {
  return createCommandButtonGroup(context, [
    ['undo', 'arrow-counterclockwise', 'Undo', context.commands.undo],
    ['redo', 'arrow-clockwise', 'Redo', context.commands.redo]
  ]);
}
