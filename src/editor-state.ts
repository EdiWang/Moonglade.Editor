import type { Mark, MarkType, NodeType } from 'prosemirror-model';
import type { Command, EditorState } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

export function canRun(state: EditorState, view: EditorView, command: Command): boolean {
  return command(state, undefined, view);
}

export function firstCommand(commands: Map<string, Command>): Command | undefined {
  return commands.values().next().value;
}

export function getPaletteColor(value: unknown, commands: Map<string, Command>): string {
  if (typeof value !== 'string') {
    return '';
  }

  const normalized = value.trim().toLowerCase();
  for (const color of commands.keys()) {
    if (color.toLowerCase() === normalized) {
      return color;
    }
  }

  const rgb = normalized.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/);
  if (!rgb) {
    return '';
  }

  const hex = `#${rgb.slice(1, 4)
    .map((channel) => Number(channel).toString(16).padStart(2, '0'))
    .join('')}`;
  for (const color of commands.keys()) {
    if (color.toLowerCase() === hex) {
      return color;
    }
  }

  return '';
}

export function canEditLink(state: EditorState, activeLink: Mark | null): boolean {
  return Boolean(activeLink) || !state.selection.empty;
}

export function getCurrentFormat(state: EditorState): string {
  const { $from } = state.selection;
  const parent = $from.parent;

  if (parent.type.name === 'heading') {
    return `heading:${parent.attrs.level}`;
  }

  return 'paragraph';
}

export function getCurrentAlignment(state: EditorState): string {
  const align = state.selection.$from.parent.attrs.align;
  return typeof align === 'string' && align ? align : 'left';
}

export function getCurrentCodeLanguage(state: EditorState): string {
  const { parent } = state.selection.$from;

  if (parent.type.name !== 'code_block') {
    return '';
  }

  const language = parent.attrs.language;
  return typeof language === 'string' ? language : '';
}

export function hasAncestor(state: EditorState, nodeType: NodeType): boolean {
  const { $from } = state.selection;

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type === nodeType) {
      return true;
    }
  }

  return false;
}

export function isMarkActive(state: EditorState, markType: MarkType): boolean {
  const { empty, from, to, $from } = state.selection;

  if (empty) {
    return Boolean(markType.isInSet(state.storedMarks || $from.marks()));
  }

  return state.doc.rangeHasMark(from, to, markType);
}

export function getActiveMark(state: EditorState, markType: MarkType): Mark | null {
  const { empty, from, to, $from } = state.selection;

  if (empty) {
    return markType.isInSet(state.storedMarks || $from.marks()) ?? null;
  }

  let activeMark: Mark | null = null;
  state.doc.nodesBetween(from, to, (node) => {
    activeMark = markType.isInSet(node.marks) ?? null;
    return !activeMark;
  });

  return activeMark;
}
