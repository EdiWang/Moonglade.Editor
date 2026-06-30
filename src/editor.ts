import { baseKeymap } from 'prosemirror-commands';
import { gapCursor } from 'prosemirror-gapcursor';
import { history, redo, undo } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import type { Node as ProseMirrorNode, Schema } from 'prosemirror-model';
import { EditorState, type Command, type Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { tableEditing } from 'prosemirror-tables';
import { createCommands, type MoongladeEditorCommands } from './commands';
import { parseHtml, serializeHtml } from './html';
import { moongladeSchema } from './schema';

export interface MoongladeEditorOptions {
  element: HTMLElement;
  textarea?: HTMLTextAreaElement;
  content?: string;
  schema?: Schema;
  uploadUrl?: string;
  onChange?: (html: string) => void;
}

export class MoongladeEditor {
  readonly schema: Schema;
  readonly commands: MoongladeEditorCommands;
  readonly uploadUrl?: string;

  private readonly textarea?: HTMLTextAreaElement;
  private readonly onChange?: (html: string) => void;
  private view: EditorView;

  constructor(options: MoongladeEditorOptions) {
    this.schema = options.schema || moongladeSchema;
    this.commands = createCommands(this.schema);
    this.textarea = options.textarea;
    this.uploadUrl = options.uploadUrl;
    this.onChange = options.onChange;

    const initialContent = options.content ?? options.textarea?.value ?? '';
    const doc = parseHtml(this.schema, initialContent);

    this.view = new EditorView(options.element, {
      state: EditorState.create({
        doc,
        schema: this.schema,
        plugins: [
          history(),
          gapCursor(),
          tableEditing(),
          keymap({
            'Mod-z': undo,
            'Mod-y': redo,
            'Shift-Mod-z': redo
          }),
          keymap(baseKeymap)
        ]
      }),
      dispatchTransaction: (transaction) => this.dispatch(transaction)
    });

    this.syncToTextarea();
  }

  get dom(): HTMLElement {
    return this.view.dom;
  }

  get doc(): ProseMirrorNode {
    return this.view.state.doc;
  }

  getHTML(): string {
    return serializeHtml(this.schema, this.view.state.doc);
  }

  setHTML(html: string): void {
    const doc = parseHtml(this.schema, html);
    const state = EditorState.create({
      doc,
      schema: this.schema,
      plugins: this.view.state.plugins
    });

    this.view.updateState(state);
    this.syncToTextarea();
  }

  run(command: Command): boolean {
    return command(this.view.state, this.view.dispatch, this.view);
  }

  focus(): void {
    this.view.focus();
  }

  destroy(): void {
    this.view.destroy();
  }

  syncToTextarea(): void {
    const html = this.getHTML();
    if (this.textarea) {
      this.textarea.value = html;
      this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    this.onChange?.(html);
  }

  private dispatch(transaction: Transaction): void {
    this.view.updateState(this.view.state.apply(transaction));
    this.syncToTextarea();
  }
}

export function createMoongladeEditor(options: MoongladeEditorOptions): MoongladeEditor {
  return new MoongladeEditor(options);
}
