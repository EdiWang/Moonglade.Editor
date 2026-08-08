import type { Command } from 'prosemirror-state';
import type { MoongladeEditorCommands } from './commands';

export function createRichHtmlKeyboardShortcutMap(commands: MoongladeEditorCommands): Record<string, Command> {
  return {
    ...modShortcut(commands.undo, 'z'),
    ...modShortcut(commands.redo, 'y'),
    ...shiftModShortcut(commands.redo, 'z'),
    ...modShortcut(commands.bold, 'b'),
    ...modShortcut(commands.italic, 'i'),
    ...modShortcut(commands.underline, 'u'),
    ...shiftModShortcut(commands.strike, 'x'),
    ...modShortcut(commands.inlineCode, '`')
  };
}

function modShortcut(command: Command, key: string): Record<string, Command> {
  return {
    [`Ctrl-${key}`]: command,
    [`Meta-${key}`]: command,
    [`Mod-${key}`]: command
  };
}

function shiftModShortcut(command: Command, key: string): Record<string, Command> {
  return {
    [`Shift-Ctrl-${key}`]: command,
    [`Shift-Meta-${key}`]: command,
    [`Shift-Mod-${key}`]: command
  };
}
