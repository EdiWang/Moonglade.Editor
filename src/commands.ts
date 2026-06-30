import { setBlockType, toggleMark, wrapIn } from 'prosemirror-commands';
import type { Command } from 'prosemirror-state';
import { wrapInList } from 'prosemirror-schema-list';
import type { Schema } from 'prosemirror-model';

export function createCommands(schema: Schema) {
  return {
    paragraph: setBlockType(schema.nodes.paragraph),
    heading: (level: number): Command => setBlockType(schema.nodes.heading, { level }),
    bold: toggleMark(schema.marks.strong),
    italic: toggleMark(schema.marks.em),
    underline: toggleMark(schema.marks.underline),
    strike: toggleMark(schema.marks.strike),
    blockquote: wrapIn(schema.nodes.blockquote),
    bulletList: wrapInList(schema.nodes.bullet_list),
    orderedList: wrapInList(schema.nodes.ordered_list),
    link: (href: string, title?: string): Command => toggleMark(schema.marks.link, { href, title: title || null }),
    textColor: (color: string): Command => toggleMark(schema.marks.text_color, { color }),
    backgroundColor: (color: string): Command => toggleMark(schema.marks.background_color, { color })
  };
}

export type MoongladeEditorCommands = ReturnType<typeof createCommands>;
