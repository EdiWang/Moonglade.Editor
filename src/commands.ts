import { lift, setBlockType, toggleMark, wrapIn } from 'prosemirror-commands';
import { redo, undo } from 'prosemirror-history';
import type { Mark, MarkType, Node as ProseMirrorNode, NodeType, Schema } from 'prosemirror-model';
import { liftListItem, wrapInList } from 'prosemirror-schema-list';
import type { Command, EditorState } from 'prosemirror-state';
import {
  addColumnAfter,
  addRowAfter,
  findTable,
  deleteColumn,
  deleteRow,
  deleteTable,
  toggleHeaderRow
} from 'prosemirror-tables';
import { TextSelection } from 'prosemirror-state';
import { sanitizeCodeLanguage, sanitizeImageUrl, sanitizeLinkUrl, sanitizeStyleValue, sanitizeTextAlign, type TextAlignment } from './safety';

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
    clearBackgroundColor: removeMark(schema.marks.background_color),
    alignment: (align: TextAlignment): Command => setTextAlignment(schema, align),
    insertImage: (src: string, alt?: string, title?: string): Command => insertImage(schema, src, alt, title),
    codeBlock: (language?: string): Command => setCodeBlock(schema, language),
    insertHorizontalRule: insertHorizontalRule(schema),
    insertTable: (rows = 3, columns = 3): Command => insertTable(schema, rows, columns),
    addTableRow: addRowAfter,
    deleteTableRow: deleteRow,
    addTableColumn: addColumnAfter,
    deleteTableColumn: deleteColumn,
    toggleTableHeaderRow: toggleHeaderRow,
    deleteTable
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
    const selectedLists = getSelectedLists(state, schema);
    const hasDifferentSelectedListType = selectedLists.some((list) => list.node.type !== listType);

    if (hasDifferentSelectedListType) {
      return convertSelectedLists(state, selectedLists, listType, dispatch);
    }

    const activeList = getActiveList(state, schema);

    if (activeList?.node.type === listType) {
      return liftListItem(schema.nodes.list_item)(state, dispatch, view);
    }

    if (activeList) {
      if (dispatch) {
        dispatch(state.tr.setNodeMarkup(activeList.pos, listType, getListAttrs(listType, activeList.node.attrs)).scrollIntoView());
      }

      return true;
    }

    return wrapInList(listType)(state, dispatch, view);
  };
}

type ListRange = { node: ProseMirrorNode; pos: number };

function convertSelectedLists(state: EditorState, selectedLists: ListRange[], listType: NodeType, dispatch: Parameters<Command>[1]): boolean {
  if (!selectedLists.length) {
    return false;
  }

  if (dispatch) {
    const transaction = state.tr;
    const joinPositions = getSelectedListJoinPositions(selectedLists);

    for (const list of selectedLists) {
      transaction.setNodeMarkup(list.pos, listType, getListAttrs(listType, list.node.attrs));
    }

    for (const pos of joinPositions.sort((a, b) => b - a)) {
      if (canJoinListAt(transaction.doc, pos, listType)) {
        transaction.join(pos);
      }
    }

    dispatch(transaction.scrollIntoView());
  }

  return true;
}

function getActiveList(state: EditorState, schema: Schema): { node: ProseMirrorNode; pos: number } | null {
  const listTypes = new Set([schema.nodes.bullet_list, schema.nodes.ordered_list]);
  const { $from } = state.selection;

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (listTypes.has(node.type)) {
      return { node, pos: $from.before(depth) };
    }
  }

  return null;
}

function getSelectedLists(state: EditorState, schema: Schema): ListRange[] {
  const listTypes = new Set([schema.nodes.bullet_list, schema.nodes.ordered_list]);
  const lists = new Map<number, ListRange>();
  const activeList = getActiveList(state, schema);

  if (activeList) {
    lists.set(activeList.pos, activeList);
  }

  if (!state.selection.empty) {
    state.doc.nodesBetween(state.selection.from, state.selection.to, (node, pos) => {
      if (listTypes.has(node.type)) {
        lists.set(pos, { node, pos });
        return false;
      }

      return true;
    });
  }

  return Array.from(lists.values()).sort((a, b) => a.pos - b.pos);
}

function getSelectedListJoinPositions(selectedLists: ListRange[]): number[] {
  const positions: number[] = [];

  for (let index = 0; index < selectedLists.length - 1; index += 1) {
    const current = selectedLists[index];
    const next = selectedLists[index + 1];
    const boundary = current.pos + current.node.nodeSize;

    if (boundary === next.pos) {
      positions.push(boundary);
    }
  }

  return positions;
}

function canJoinListAt(doc: ProseMirrorNode, pos: number, listType: NodeType): boolean {
  if (pos <= 0 || pos >= doc.content.size) {
    return false;
  }

  const resolved = doc.resolve(pos);
  const before = resolved.nodeBefore;
  const after = resolved.nodeAfter;

  return Boolean(before && after && before.type === listType && after.type === listType && before.canAppend(after));
}

function getListAttrs(listType: NodeType, currentAttrs?: Record<string, unknown>): Record<string, unknown> {
  const attrs: Record<string, unknown> = {
    class: currentAttrs?.class || null
  };

  if (listType.name === 'ordered_list') {
    attrs.order = typeof currentAttrs?.order === 'number' ? currentAttrs.order : 1;
  }

  return attrs;
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
  const safeHref = sanitizeLinkUrl(href);
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
        .addMark(markFrom, markTo, markType.create({
          href: safeHref,
          title: title?.trim() || null,
          class: range?.mark.attrs.class || null
        }));
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

function setTextAlignment(schema: Schema, align: TextAlignment): Command {
  const safeAlign = sanitizeTextAlign(align);
  if (!safeAlign) {
    return () => false;
  }

  return (state, dispatch) => {
    const updates = getAlignableBlocks(state, schema);

    if (!updates.length) {
      return false;
    }

    if (dispatch) {
      const transaction = state.tr;
      for (const { node, pos } of updates) {
        transaction.setNodeMarkup(pos, undefined, { ...node.attrs, align: safeAlign });
      }

      dispatch(transaction.scrollIntoView());
    }

    return true;
  };
}

function insertImage(schema: Schema, src: string, alt?: string, title?: string): Command {
  const safeSrc = sanitizeImageUrl(src);
  if (!safeSrc) {
    return () => false;
  }

  return (state, dispatch) => {
    const image = schema.nodes.image.create({
      src: safeSrc,
      alt: alt?.trim() || null,
      title: title?.trim() || null
    });

    if (dispatch) {
      dispatch(state.tr.replaceSelectionWith(image).scrollIntoView());
    }

    return true;
  };
}

function setCodeBlock(schema: Schema, language?: string): Command {
  const safeLanguage = sanitizeCodeLanguage(language) || null;
  return setBlockType(schema.nodes.code_block, { language: safeLanguage });
}

function insertHorizontalRule(schema: Schema): Command {
  const horizontalRule = schema.nodes.horizontal_rule;
  if (!horizontalRule) {
    return () => false;
  }

  return (state, dispatch) => {
    if (!canInsertNode(state, horizontalRule)) {
      return false;
    }

    if (dispatch) {
      dispatch(state.tr.replaceSelectionWith(horizontalRule.create()).scrollIntoView());
    }

    return true;
  };
}

function canInsertNode(state: EditorState, nodeType: NodeType): boolean {
  const { $from } = state.selection;

  for (let depth = $from.depth; depth >= 0; depth -= 1) {
    const index = $from.index(depth);
    if ($from.node(depth).canReplaceWith(index, index, nodeType)) {
      return true;
    }
  }

  return false;
}

function insertTable(schema: Schema, rows: number, columns: number): Command {
  const rowCount = Math.max(1, Math.min(rows, 12));
  const columnCount = Math.max(1, Math.min(columns, 8));

  return (state, dispatch) => {
    const { table, table_row: tableRow, table_cell: tableCell, paragraph } = schema.nodes;
    const rowNodes = Array.from({ length: rowCount }, () => tableRow.create(null,
      Array.from({ length: columnCount }, () => tableCell.create(null, paragraph.create()))));
    const tableNode = table.create(null, rowNodes);

    if (dispatch) {
      const insertionPoint = state.selection.from;
      const transaction = state.tr.replaceSelectionWith(tableNode);
      const tablePos = findTable(transaction.selection.$from)?.pos
        ?? findTableAtOrAfter(transaction.doc, table, transaction.mapping.map(insertionPoint, -1));

      if (typeof tablePos === 'number') {
        transaction.setSelection(TextSelection.create(transaction.doc, tablePos + 4));
      }

      dispatch(transaction.scrollIntoView());
    }

    return true;
  };
}

function findTableAtOrAfter(doc: ProseMirrorNode, tableType: NodeType, startPos: number): number | undefined {
  let fallbackBefore: number | undefined;
  let tablePos: number | undefined;

  doc.descendants((node, pos) => {
    if (node.type !== tableType) {
      return true;
    }

    if (pos >= startPos) {
      tablePos = pos;
      return false;
    }

    fallbackBefore = pos;
    return true;
  });

  return tablePos ?? fallbackBefore;
}

function getAlignableBlocks(state: EditorState, schema: Schema): Array<{ node: ProseMirrorNode; pos: number }> {
  const alignable = new Set([schema.nodes.paragraph, schema.nodes.heading]);
  const updates: Array<{ node: ProseMirrorNode; pos: number }> = [];
  const { selection } = state;

  if (selection.empty && alignable.has(selection.$from.parent.type)) {
    updates.push({ node: selection.$from.parent, pos: selection.$from.before(selection.$from.depth) });
    return updates;
  }

  state.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
    if (alignable.has(node.type)) {
      updates.push({ node, pos });
      return false;
    }

    return true;
  });

  return updates;
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
