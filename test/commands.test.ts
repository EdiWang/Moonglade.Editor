import { describe, expect, it } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import type { Command } from 'prosemirror-state';
import { findTable } from 'prosemirror-tables';
import { createCommands } from '../src/commands';
import { parseHtml, serializeHtml } from '../src/html';
import { moongladeSchema } from '../src/schema';

function createState(html: string): EditorState {
  return EditorState.create({
    schema: moongladeSchema,
    doc: parseHtml(moongladeSchema, html)
  });
}

function runCommand(state: EditorState, command: Command): { result: boolean; state: EditorState } {
  let nextState = state;
  const result = command(state, (transaction) => {
    nextState = state.apply(transaction);
  });

  return { result, state: nextState };
}

function setSelection(state: EditorState, from: number, to = from): EditorState {
  return state.apply(state.tr.setSelection(TextSelection.create(state.doc, from, to)));
}

function getHtml(state: EditorState): string {
  return serializeHtml(moongladeSchema, state.doc);
}

function findTextPosition(state: EditorState, text: string): number {
  let textPosition = -1;
  state.doc.descendants((node, pos) => {
    if (node.isText && node.text?.includes(text)) {
      textPosition = pos + node.text.indexOf(text);
      return false;
    }

    return true;
  });

  if (textPosition === -1) {
    throw new Error(`Unable to find text "${text}".`);
  }

  return textPosition;
}

function getTablePositions(state: EditorState): number[] {
  const positions: number[] = [];
  state.doc.descendants((node, pos) => {
    if (node.type === moongladeSchema.nodes.table) {
      positions.push(pos);
    }

    return true;
  });

  return positions;
}

describe('editor commands', () => {
  const commands = createCommands(moongladeSchema);

  it('updates the full active link range when the cursor is inside a link', () => {
    const state = setSelection(createState('<p><a href="https://old.example">Hello</a> world</p>'), 3);
    const { result, state: nextState } = runCommand(state, commands.link('https://new.example', 'New'));

    expect(result).toBe(true);
    expect(getHtml(nextState)).toBe('<p><a href="https://new.example" title="New">Hello</a> world</p>');
  });

  it('allows mail links but rejects unsupported link protocols', () => {
    const state = setSelection(createState('<p>Hello</p>'), 1, 6);
    const linked = runCommand(state, commands.link('mailto:hello@example.com'));
    const ftp = runCommand(state, commands.link('ftp://example.com/file.txt'));

    expect(linked.result).toBe(true);
    expect(getHtml(linked.state)).toBe('<p><a href="mailto:hello@example.com">Hello</a></p>');
    expect(ftp.result).toBe(false);
    expect(getHtml(ftp.state)).toBe('<p>Hello</p>');
  });

  it('removes the full active link range when the cursor is inside a link', () => {
    const state = setSelection(createState('<p><a href="https://example.com">Hello</a> world</p>'), 3);
    const { result, state: nextState } = runCommand(state, commands.removeLink);

    expect(result).toBe(true);
    expect(getHtml(nextState)).toBe('<p>Hello world</p>');
  });

  it('stores color marks for future text when the selection is empty', () => {
    const state = setSelection(createState('<p>Hello</p>'), 1);
    const { result, state: nextState } = runCommand(state, commands.textColor('#0d6efd'));
    const mark = moongladeSchema.marks.text_color.isInSet(nextState.storedMarks ?? []);

    expect(result).toBe(true);
    expect(mark?.attrs.color).toBe('#0d6efd');
  });

  it('applies alignment to every selected alignable block', () => {
    const state = setSelection(createState('<p>One</p><h2>Two</h2>'), 1, 9);
    const { result, state: nextState } = runCommand(state, commands.alignment('right'));

    expect(result).toBe(true);
    expect(getHtml(nextState)).toBe(`<p style="text-align: right;">One</p>
<h2 style="text-align: right;">Two</h2>`);
  });

  it('sanitizes code block language attributes', () => {
    const state = setSelection(createState('<p>alert(1)</p>'), 1, 9);
    const { result, state: nextState } = runCommand(state, commands.codeBlock('javascript:alert(1)'));

    expect(result).toBe(true);
    expect(getHtml(nextState)).toBe('<pre><code>alert(1)</code></pre>');
  });

  it('inserts horizontal rules', () => {
    const state = setSelection(createState('<p>Hello</p>'), 6);
    const { result, state: nextState } = runCommand(state, commands.insertHorizontalRule);

    expect(result).toBe(true);
    expect(getHtml(nextState)).toBe(`<p>Hello</p>
<hr>`);
  });

  it('clamps inserted table dimensions', () => {
    const state = setSelection(createState('<p>Hello</p>'), 1, 6);
    const { result, state: nextState } = runCommand(state, commands.insertTable(99, 99));
    const html = getHtml(nextState);

    expect(result).toBe(true);
    expect(html.match(/<tr>/g)).toHaveLength(12);
    expect(html.match(/<td>/g)).toHaveLength(96);
  });

  it('places the selection inside the newly inserted table when another table already exists', () => {
    const state = createState('<table><tbody><tr><td><p>Existing</p></td></tr></tbody></table><p>Insert here</p>');
    const insertionPoint = findTextPosition(state, 'Insert here') + 'Insert here'.length;
    const { result, state: nextState } = runCommand(setSelection(state, insertionPoint), commands.insertTable(2, 2));
    const tablePositions = getTablePositions(nextState);
    const activeTable = findTable(nextState.selection.$from);

    expect(result).toBe(true);
    expect(tablePositions).toHaveLength(2);
    expect(activeTable?.pos).toBe(tablePositions[1]);
  });

  it('rejects unsupported image protocols', () => {
    const state = setSelection(createState('<p>Hello</p>'), 1, 6);
    const { result, state: nextState } = runCommand(state, commands.insertImage('mailto:hello@example.com', 'Bad'));

    expect(result).toBe(false);
    expect(getHtml(nextState)).toBe('<p>Hello</p>');
  });
});
