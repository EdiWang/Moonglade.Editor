import { lift, setBlockType, toggleMark, wrapIn } from 'prosemirror-commands';
import { redo, undo } from 'prosemirror-history';
import type { NodeType, Schema } from 'prosemirror-model';
import { liftListItem, wrapInList } from 'prosemirror-schema-list';
import type { Command, EditorState } from 'prosemirror-state';

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
    link: (href: string, title?: string): Command => toggleMark(schema.marks.link, { href, title: title || null }),
    textColor: (color: string): Command => toggleMark(schema.marks.text_color, { color }),
    backgroundColor: (color: string): Command => toggleMark(schema.marks.background_color, { color })
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
