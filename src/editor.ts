import { baseKeymap } from 'prosemirror-commands';
import { gapCursor } from 'prosemirror-gapcursor';
import { history, redo, undo } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import type { MarkType, Node as ProseMirrorNode, NodeType, Schema } from 'prosemirror-model';
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

interface ToolbarElements {
  root: HTMLDivElement;
  formatSelect: HTMLSelectElement;
  buttons: Record<string, HTMLButtonElement>;
}

export class MoongladeEditor {
  readonly schema: Schema;
  readonly commands: MoongladeEditorCommands;
  readonly uploadUrl?: string;

  private readonly textarea?: HTMLTextAreaElement;
  private readonly onChange?: (html: string) => void;
  private readonly toolbar: ToolbarElements;
  private view: EditorView;

  constructor(options: MoongladeEditorOptions) {
    this.schema = options.schema || moongladeSchema;
    this.commands = createCommands(this.schema);
    this.textarea = options.textarea;
    this.uploadUrl = options.uploadUrl;
    this.onChange = options.onChange;

    const initialContent = options.content ?? options.textarea?.value ?? '';
    const doc = parseHtml(this.schema, initialContent);
    const editorHost = document.createElement('div');
    editorHost.className = 'mg-editor-body';

    options.element.classList.add('mg-editor');
    options.element.replaceChildren();

    this.toolbar = this.createToolbar();
    options.element.append(this.toolbar.root, editorHost);

    this.view = new EditorView(editorHost, {
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
      dispatchTransaction: (transaction) => this.dispatch(transaction),
      handleDOMEvents: {
        keyup: () => {
          this.updateToolbarState();
          return false;
        },
        mouseup: () => {
          this.updateToolbarState();
          return false;
        }
      }
    });

    this.syncToTextarea();
    this.updateToolbarState();
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
    this.updateToolbarState();
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
    if (transaction.docChanged) {
      this.syncToTextarea();
    }

    this.updateToolbarState();
  }

  private createToolbar(): ToolbarElements {
    const root = document.createElement('div');
    root.className = 'mg-editor-toolbar btn-toolbar gap-2 p-2 border-bottom';
    root.setAttribute('role', 'toolbar');
    root.setAttribute('aria-label', 'Editor toolbar');

    const formatSelect = document.createElement('select');
    formatSelect.className = 'mg-editor-format form-select form-select-sm';
    formatSelect.setAttribute('aria-label', 'Block format');

    const formats = [
      { value: 'paragraph', label: 'Paragraph' },
      { value: 'heading:1', label: 'Heading 1' },
      { value: 'heading:2', label: 'Heading 2' },
      { value: 'heading:3', label: 'Heading 3' },
      { value: 'heading:4', label: 'Heading 4' },
      { value: 'heading:5', label: 'Heading 5' },
      { value: 'heading:6', label: 'Heading 6' }
    ];

    for (const format of formats) {
      const option = document.createElement('option');
      option.value = format.value;
      option.textContent = format.label;
      formatSelect.append(option);
    }

    formatSelect.addEventListener('change', () => {
      const [type, level] = formatSelect.value.split(':');
      this.execute(type === 'heading'
        ? this.commands.heading(Number(level))
        : this.commands.paragraph);
    });

    const buttons: Record<string, HTMLButtonElement> = {};
    const addGroup = (...items: Array<[string, string, string, Command]>): void => {
      const group = document.createElement('div');
      group.className = 'btn-group btn-group-sm';
      group.setAttribute('role', 'group');

      for (const [name, label, ariaLabel, command] of items) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'mg-editor-toolbar-button btn btn-outline-secondary';
        button.dataset.command = name;
        button.textContent = label;
        button.setAttribute('aria-label', ariaLabel);
        button.setAttribute('aria-pressed', 'false');
        button.addEventListener('mousedown', (event) => event.preventDefault());
        button.addEventListener('click', () => this.execute(command));

        buttons[name] = button;
        group.append(button);
      }

      root.append(group);
    };

    const formatGroup = document.createElement('div');
    formatGroup.className = 'mg-editor-format-group';
    formatGroup.append(formatSelect);
    root.append(formatGroup);

    addGroup(
      ['undo', 'Undo', 'Undo', this.commands.undo],
      ['redo', 'Redo', 'Redo', this.commands.redo]
    );
    addGroup(
      ['bold', 'B', 'Bold', this.commands.bold],
      ['italic', 'I', 'Italic', this.commands.italic],
      ['underline', 'U', 'Underline', this.commands.underline],
      ['strike', 'S', 'Strikethrough', this.commands.strike]
    );
    addGroup(
      ['blockquote', 'Quote', 'Blockquote', this.commands.blockquote],
      ['bulletList', 'Bullets', 'Bullet list', this.commands.bulletList],
      ['orderedList', 'Numbers', 'Numbered list', this.commands.orderedList]
    );

    return { root, formatSelect, buttons };
  }

  private execute(command: Command): void {
    command(this.view.state, this.view.dispatch, this.view);
    this.view.focus();
    this.updateToolbarState();
  }

  private updateToolbarState(): void {
    const { state } = this.view;
    const { buttons, formatSelect } = this.toolbar;

    formatSelect.value = getCurrentFormat(state);

    setButtonState(buttons.bold, isMarkActive(state, this.schema.marks.strong), canRun(state, this.view, this.commands.bold));
    setButtonState(buttons.italic, isMarkActive(state, this.schema.marks.em), canRun(state, this.view, this.commands.italic));
    setButtonState(buttons.underline, isMarkActive(state, this.schema.marks.underline), canRun(state, this.view, this.commands.underline));
    setButtonState(buttons.strike, isMarkActive(state, this.schema.marks.strike), canRun(state, this.view, this.commands.strike));
    setButtonState(buttons.blockquote, hasAncestor(state, this.schema.nodes.blockquote), canRun(state, this.view, this.commands.blockquote));
    setButtonState(buttons.bulletList, hasAncestor(state, this.schema.nodes.bullet_list), canRun(state, this.view, this.commands.bulletList));
    setButtonState(buttons.orderedList, hasAncestor(state, this.schema.nodes.ordered_list), canRun(state, this.view, this.commands.orderedList));

    buttons.undo.disabled = !canRun(state, this.view, this.commands.undo);
    buttons.redo.disabled = !canRun(state, this.view, this.commands.redo);
  }
}

export function createMoongladeEditor(options: MoongladeEditorOptions): MoongladeEditor {
  return new MoongladeEditor(options);
}

function canRun(state: EditorState, view: EditorView, command: Command): boolean {
  return command(state, undefined, view);
}

function getCurrentFormat(state: EditorState): string {
  const { $from } = state.selection;
  const parent = $from.parent;

  if (parent.type.name === 'heading') {
    return `heading:${parent.attrs.level}`;
  }

  return 'paragraph';
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

function isMarkActive(state: EditorState, markType: MarkType): boolean {
  const { empty, from, to, $from } = state.selection;

  if (empty) {
    return Boolean(markType.isInSet(state.storedMarks || $from.marks()));
  }

  return state.doc.rangeHasMark(from, to, markType);
}

function setButtonState(button: HTMLButtonElement, active: boolean, enabled: boolean): void {
  button.classList.toggle('active', active);
  button.setAttribute('aria-pressed', active ? 'true' : 'false');
  button.disabled = !enabled;
}
