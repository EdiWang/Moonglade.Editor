import { lift, setBlockType, toggleMark, wrapIn } from 'prosemirror-commands';
import { redo, undo } from 'prosemirror-history';
import type { Mark, MarkType, NodeType, Schema } from 'prosemirror-model';
import { liftListItem, wrapInList } from 'prosemirror-schema-list';
import type { Command, EditorState } from 'prosemirror-state';
import { sanitizeStyleValue, sanitizeUrl } from './safety';

export function createCommands(schema: Schema) {
  return {
    paragraph: setBlockType(schema.nodes.paragraph),
    heading: (level: number): Command => setBlockType(schema.nodes.heading, { level }),
    bold: toggleMark(schema.marks.strong),
    italic: toggleMark(schema.marks.em),
    underline: toggleMark(schema.marks.underline),
    strike: toggleMark(schema.marks.strike),
    blockquote: toggleBlockquote(schema),
    bulletList: toggleList(schema, schema.nodes.bullet_list),
    orderedList: toggleList(schema, schema.nodes.ordered_list),
    undo,
    redo,
    link: (href: string, title?: string): Command => setLink(schema.marks.link, href, title),
    removeLink: removeMark(schema.marks.link),
    textColor: (color: string): Command => setColorMark(schema.marks.text_color, color),
    clearTextColor: removeMark(schema.marks.text_color),
    backgroundColor: (color: string): Command => setColorMark(schema.marks.background_color, color),
    clearBackgroundColor: removeMark(schema.marks.background_color)
  };
}

export type MoongladeEditorCommands = ReturnType<typeof createCommands>;

function toggleBlockquote(schema: Schema): Command {
  return (state, dispatch, view) => {
    if (hasAncestor(state, schema.nodes.blockquote)) {
      return lift(state, dispatch, view);
    }

    return wrapIn(schema.nodes.blockquote)(state, dispatch, view);
  };
}

function toggleList(schema: Schema, listType: NodeType): Command {
  return (state, dispatch, view) => {
    if (hasAncestor(state, listType)) {
      return liftListItem(schema.nodes.list_item)(state, dispatch, view);
    }

    return wrapInList(listType)(state, dispatch, view);
  };
}

function hasAncestor(state: EditorState, nodeType: NodeType): boolean {
  const { $from } = state.selection;

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type === nodeType) {
      return true;
    }
  }

  return false;
}

function setLink(markType: MarkType, href: string, title?: string): Command {
  const safeHref = sanitizeUrl(href);
  if (!safeHref) {
    return () => false;
  }

  return (state, dispatch) => {
    const range = getMarkRange(state, markType);
    const { from, to, empty } = state.selection;

    if (!range && empty) {
      return false;
    }

    if (dispatch) {
      const transaction = state.tr;
      const markFrom = range?.from ?? from;
      const markTo = range?.to ?? to;
      transaction
        .removeMark(markFrom, markTo, markType)
        .addMark(markFrom, markTo, markType.create({ href: safeHref, title: title?.trim() || null }));
      dispatch(transaction);
    }

    return true;
  };
}

function setColorMark(markType: MarkType, color: string): Command {
  const safeColor = sanitizeStyleValue(color);
  if (!safeColor) {
    return () => false;
  }

  return (state, dispatch) => {
    const { empty, from, to } = state.selection;

    if (dispatch) {
      const mark = markType.create({ color: safeColor });
      const transaction = state.tr;

      if (empty) {
        transaction.removeStoredMark(markType).addStoredMark(mark);
      } else {
        transaction.removeMark(from, to, markType).addMark(from, to, mark);
      }

      dispatch(transaction);
    }

    return true;
  };
}

function removeMark(markType: MarkType): Command {
  return (state, dispatch) => {
    const range = getMarkRange(state, markType);
    const { empty, from, to } = state.selection;

    if (!range && empty && !markType.isInSet(state.storedMarks || [])) {
      return false;
    }

    if (dispatch) {
      const transaction = state.tr;

      if (!empty) {
        transaction.removeMark(from, to, markType);
      } else if (range) {
        transaction.removeMark(range.from, range.to, markType);
      } else {
        transaction.removeStoredMark(markType);
      }

      dispatch(transaction);
    }

    return true;
  };
}

function getMarkRange(state: EditorState, markType: MarkType): { from: number; to: number; mark: Mark } | null {
  const { $from } = state.selection;
  const parent = $from.parent;
  const start = $from.start();
  const cursor = $from.parentOffset;
  const mark = markType.isInSet(state.storedMarks || $from.marks());

  if (!mark) {
    return null;
  }

  let markIndex = -1;
  let from = 0;
  let to = 0;

  parent.forEach((node, offset, index) => {
    const end = offset + node.nodeSize;
    if (markIndex === -1 && offset <= cursor && cursor <= end && node.marks.some((candidate) => candidate.eq(mark))) {
      markIndex = index;
      from = offset;
      to = end;
    }
  });

  if (markIndex === -1) {
    return null;
  }

  while (markIndex > 0 && parent.child(markIndex - 1).marks.some((candidate) => candidate.eq(mark))) {
    markIndex -= 1;
    from -= parent.child(markIndex).nodeSize;
  }

  while (markIndex + 1 < parent.childCount && parent.child(markIndex + 1).marks.some((candidate) => candidate.eq(mark))) {
    markIndex += 1;
    to += parent.child(markIndex).nodeSize;
  }

  return { from: start + from, to: start + to, mark };
}
