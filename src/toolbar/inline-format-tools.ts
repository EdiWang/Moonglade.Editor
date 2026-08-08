import { createCommandButtonGroup } from './dom';
import type { ToolbarContext } from './types';

export function createInlineFormatTools(context: ToolbarContext): HTMLDivElement {
  return createCommandButtonGroup(context, [
    ['bold', 'type-bold', 'Bold', context.commands.bold, modShortcut('B')],
    ['italic', 'type-italic', 'Italic', context.commands.italic, modShortcut('I')],
    ['underline', 'type-underline', 'Underline', context.commands.underline, modShortcut('U')],
    ['strike', 'type-strikethrough', 'Strikethrough', context.commands.strike, shiftModShortcut('X')]
  ]);
}

function modShortcut(key: string) {
  return {
    title: `Ctrl+${key}`,
    ariaKeyShortcuts: `Control+${key} Meta+${key}`
  };
}

function shiftModShortcut(key: string) {
  return {
    title: `Ctrl+Shift+${key}`,
    ariaKeyShortcuts: `Control+Shift+${key} Meta+Shift+${key}`
  };
}
