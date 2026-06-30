import { baseKeymap } from 'prosemirror-commands';
import { gapCursor } from 'prosemirror-gapcursor';
import { history, redo, undo } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import type { Mark, MarkType, Node as ProseMirrorNode, NodeType, Schema } from 'prosemirror-model';
import { EditorState, TextSelection, type Command, type SelectionBookmark, type Transaction } from 'prosemirror-state';
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
  colorButtons: ColorButton[];
  imageInput: HTMLInputElement;
  uploadStatus: HTMLDivElement;
  linkDialog: LinkDialogElements;
}

interface ColorButton {
  button: HTMLButtonElement;
  markType: MarkType;
  color: string;
  command: Command;
}

interface LinkDialogElements {
  root: HTMLDivElement;
  form: HTMLFormElement;
  hrefInput: HTMLInputElement;
  titleInput: HTMLInputElement;
  error: HTMLDivElement;
  removeButton: HTMLButtonElement;
  cancelButton: HTMLButtonElement;
}

export class MoongladeEditor {
  readonly schema: Schema;
  readonly commands: MoongladeEditorCommands;
  readonly uploadUrl?: string;

  private readonly textarea?: HTMLTextAreaElement;
  private readonly onChange?: (html: string) => void;
  private readonly toolbar: ToolbarElements;
  private savedSelection?: SelectionBookmark;
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
      },
      handlePaste: (_view, event) => this.handleImagePaste(event),
      handleDrop: (view, event) => this.handleImageDrop(view, event)
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

  private handleImagePaste(event: ClipboardEvent): boolean {
    const file = getFirstImageFile(event.clipboardData?.files);

    if (!file || !this.uploadUrl) {
      return false;
    }

    event.preventDefault();
    this.savedSelection = this.view.state.selection.getBookmark();
    void this.uploadAndInsertImage(file);
    return true;
  }

  private handleImageDrop(view: EditorView, event: DragEvent): boolean {
    const file = getFirstImageFile(event.dataTransfer?.files);

    if (!file || !this.uploadUrl) {
      return false;
    }

    const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
    if (coordinates) {
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, coordinates.pos)));
    }

    event.preventDefault();
    this.savedSelection = this.view.state.selection.getBookmark();
    void this.uploadAndInsertImage(file);
    return true;
  }

  private async uploadAndInsertImage(file: File): Promise<boolean> {
    if (!this.uploadUrl) {
      this.setUploadStatus('Image upload is not configured.', true);
      return false;
    }

    this.setUploadStatus('Uploading image...');

    try {
      const formData = new FormData();
      formData.append('file', file, file.name);

      const response = await fetch(this.uploadUrl, {
        method: 'POST',
        body: formData,
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Image upload failed with status ${response.status}.`);
      }

      const result = await response.json() as { location?: unknown; filename?: unknown };
      const location = typeof result.location === 'string' ? result.location : '';
      const filename = typeof result.filename === 'string' ? result.filename : file.name;
      const inserted = this.executeWithSavedSelection(this.commands.insertImage(location, filename));

      if (!inserted) {
        throw new Error('The uploaded image response did not include a safe image URL.');
      }

      this.savedSelection = undefined;
      this.setUploadStatus('');
      return true;
    } catch (error) {
      this.savedSelection = undefined;
      const message = error instanceof Error ? error.message : 'Image upload failed.';
      this.setUploadStatus(message, true);
      return false;
    }
  }

  private setUploadStatus(message: string, isError = false): void {
    this.toolbar.uploadStatus.textContent = message;
    this.toolbar.uploadStatus.hidden = !message;
    this.toolbar.uploadStatus.classList.toggle('text-danger', isError);
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
    const colorButtons: ColorButton[] = [];

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
    addGroup(
      ['alignLeft', 'Left', 'Align left', this.commands.alignment('left')],
      ['alignCenter', 'Center', 'Align center', this.commands.alignment('center')],
      ['alignRight', 'Right', 'Align right', this.commands.alignment('right')],
      ['alignJustify', 'Justify', 'Justify text', this.commands.alignment('justify')]
    );

    const linkGroup = document.createElement('div');
    linkGroup.className = 'btn-group btn-group-sm';
    linkGroup.setAttribute('role', 'group');

    const linkButton = this.createToolbarButton('link', 'Link', 'Add or edit link');
    linkButton.addEventListener('click', () => this.openLinkDialog());
    const removeLinkButton = this.createToolbarButton('removeLink', 'Unlink', 'Remove link');
    removeLinkButton.addEventListener('click', () => this.execute(this.commands.removeLink));
    buttons.link = linkButton;
    buttons.removeLink = removeLinkButton;
    linkGroup.append(linkButton, removeLinkButton);
    root.append(linkGroup);

    root.append(
      this.createColorGroup('Text color', this.schema.marks.text_color, (color) => this.commands.textColor(color), this.commands.clearTextColor, colorButtons),
      this.createColorGroup('Background color', this.schema.marks.background_color, (color) => this.commands.backgroundColor(color), this.commands.clearBackgroundColor, colorButtons)
    );

    const imageGroup = document.createElement('div');
    imageGroup.className = 'btn-group btn-group-sm';
    imageGroup.setAttribute('role', 'group');

    const imageButton = this.createToolbarButton('image', 'Image', 'Upload image');
    const imageInput = document.createElement('input');
    imageInput.type = 'file';
    imageInput.accept = 'image/*';
    imageInput.hidden = true;
    imageButton.disabled = !this.uploadUrl;
    imageButton.addEventListener('click', () => {
      this.savedSelection = this.view.state.selection.getBookmark();
      imageInput.click();
    });
    imageInput.addEventListener('change', () => {
      const file = getFirstImageFile(imageInput.files);
      imageInput.value = '';

      if (file) {
        void this.uploadAndInsertImage(file);
      }
    });

    buttons.image = imageButton;
    imageGroup.append(imageButton, imageInput);
    root.append(imageGroup);

    const uploadStatus = document.createElement('div');
    uploadStatus.className = 'mg-editor-upload-status small';
    uploadStatus.setAttribute('role', 'status');
    uploadStatus.setAttribute('aria-live', 'polite');
    uploadStatus.hidden = true;
    root.append(uploadStatus);

    const linkDialog = this.createLinkDialog();
    root.append(linkDialog.root);

    return { root, formatSelect, buttons, colorButtons, imageInput, uploadStatus, linkDialog };
  }

  private execute(command: Command): void {
    command(this.view.state, this.view.dispatch, this.view);
    this.view.focus();
    this.updateToolbarState();
  }

  private createToolbarButton(name: string, label: string, ariaLabel: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mg-editor-toolbar-button btn btn-outline-secondary';
    button.dataset.command = name;
    button.textContent = label;
    button.setAttribute('aria-label', ariaLabel);
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('mousedown', (event) => event.preventDefault());
    return button;
  }

  private createColorGroup(
    label: string,
    markType: MarkType,
    commandFactory: (color: string) => Command,
    clearCommand: Command,
    colorButtons: ColorButton[]
  ): HTMLDivElement {
    const group = document.createElement('div');
    group.className = 'mg-editor-color-group btn-group btn-group-sm';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', label);

    const clearButton = this.createToolbarButton(`${markType.name}:clear`, 'Clear', `Clear ${label.toLowerCase()}`);
    clearButton.addEventListener('click', () => this.execute(clearCommand));
    group.append(clearButton);

    for (const color of colorPalette) {
      const button = this.createToolbarButton(`${markType.name}:${color.value}`, '', `${label}: ${color.label}`);
      button.classList.add('mg-editor-color-button');
      button.style.setProperty('--mg-editor-swatch', color.value);
      const command = commandFactory(color.value);
      button.addEventListener('click', () => this.execute(command));
      colorButtons.push({ button, markType, color: color.value, command });
      group.append(button);
    }

    return group;
  }

  private createLinkDialog(): LinkDialogElements {
    const root = document.createElement('div');
    root.className = 'mg-editor-dialog';
    root.hidden = true;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Link');

    const form = document.createElement('form');
    form.className = 'mg-editor-dialog-panel';

    const hrefInput = document.createElement('input');
    hrefInput.type = 'text';
    hrefInput.className = 'form-control form-control-sm';
    hrefInput.name = 'href';
    hrefInput.placeholder = 'https://example.com';
    hrefInput.setAttribute('aria-label', 'Link URL');

    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'form-control form-control-sm';
    titleInput.name = 'title';
    titleInput.placeholder = 'Title';
    titleInput.setAttribute('aria-label', 'Link title');

    const error = document.createElement('div');
    error.className = 'mg-editor-dialog-error';
    error.setAttribute('role', 'alert');
    error.hidden = true;

    const actions = document.createElement('div');
    actions.className = 'mg-editor-dialog-actions';

    const saveButton = document.createElement('button');
    saveButton.type = 'submit';
    saveButton.className = 'btn btn-primary btn-sm';
    saveButton.textContent = 'Save';

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'btn btn-outline-danger btn-sm';
    removeButton.textContent = 'Remove';
    removeButton.addEventListener('click', () => {
      this.executeWithSavedSelection(this.commands.removeLink);
      this.closeLinkDialog(true);
    });

    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'btn btn-outline-secondary btn-sm';
    cancelButton.textContent = 'Cancel';
    cancelButton.addEventListener('click', () => this.closeLinkDialog(true));

    actions.append(saveButton, removeButton, cancelButton);
    form.append(hrefInput, titleInput, error, actions);
    root.append(form);

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const applied = this.executeWithSavedSelection(this.commands.link(hrefInput.value, titleInput.value));

      if (!applied) {
        error.textContent = 'Enter a safe link URL.';
        error.hidden = false;
        hrefInput.focus();
        return;
      }

      this.closeLinkDialog(false);
    });

    return { root, form, hrefInput, titleInput, error, removeButton, cancelButton };
  }

  private openLinkDialog(): void {
    this.savedSelection = this.view.state.selection.getBookmark();
    const activeLink = getActiveMark(this.view.state, this.schema.marks.link);
    const { linkDialog } = this.toolbar;

    linkDialog.hrefInput.value = activeLink?.attrs.href ?? '';
    linkDialog.titleInput.value = activeLink?.attrs.title ?? '';
    linkDialog.error.hidden = true;
    linkDialog.removeButton.disabled = !activeLink;
    linkDialog.root.hidden = false;
    linkDialog.hrefInput.focus();
    linkDialog.hrefInput.select();
  }

  private closeLinkDialog(restoreSelection: boolean): void {
    this.toolbar.linkDialog.root.hidden = true;

    if (restoreSelection) {
      this.restoreSavedSelection();
    }

    this.savedSelection = undefined;
    this.view.focus();
    this.updateToolbarState();
  }

  private executeWithSavedSelection(command: Command): boolean {
    this.restoreSavedSelection();
    const result = command(this.view.state, this.view.dispatch, this.view);
    this.view.focus();
    this.updateToolbarState();
    return result;
  }

  private restoreSavedSelection(): void {
    if (!this.savedSelection) {
      return;
    }

    const selection = this.savedSelection.resolve(this.view.state.doc);
    this.view.dispatch(this.view.state.tr.setSelection(selection));
  }

  private updateToolbarState(): void {
    const { state } = this.view;
    const { buttons, colorButtons, formatSelect } = this.toolbar;
    const activeLink = getActiveMark(state, this.schema.marks.link);

    formatSelect.value = getCurrentFormat(state);

    setButtonState(buttons.bold, isMarkActive(state, this.schema.marks.strong), canRun(state, this.view, this.commands.bold));
    setButtonState(buttons.italic, isMarkActive(state, this.schema.marks.em), canRun(state, this.view, this.commands.italic));
    setButtonState(buttons.underline, isMarkActive(state, this.schema.marks.underline), canRun(state, this.view, this.commands.underline));
    setButtonState(buttons.strike, isMarkActive(state, this.schema.marks.strike), canRun(state, this.view, this.commands.strike));
    setButtonState(buttons.blockquote, hasAncestor(state, this.schema.nodes.blockquote), canRun(state, this.view, this.commands.blockquote));
    setButtonState(buttons.bulletList, hasAncestor(state, this.schema.nodes.bullet_list), canRun(state, this.view, this.commands.bulletList));
    setButtonState(buttons.orderedList, hasAncestor(state, this.schema.nodes.ordered_list), canRun(state, this.view, this.commands.orderedList));
    setButtonState(buttons.alignLeft, getCurrentAlignment(state) === 'left', canRun(state, this.view, this.commands.alignment('left')));
    setButtonState(buttons.alignCenter, getCurrentAlignment(state) === 'center', canRun(state, this.view, this.commands.alignment('center')));
    setButtonState(buttons.alignRight, getCurrentAlignment(state) === 'right', canRun(state, this.view, this.commands.alignment('right')));
    setButtonState(buttons.alignJustify, getCurrentAlignment(state) === 'justify', canRun(state, this.view, this.commands.alignment('justify')));
    setButtonState(buttons.link, Boolean(activeLink), canEditLink(state, activeLink));
    setButtonState(buttons.removeLink, false, Boolean(activeLink));

    for (const colorButton of colorButtons) {
      const activeColor = getActiveMark(state, colorButton.markType)?.attrs.color;
      setButtonState(colorButton.button, activeColor === colorButton.color, canRun(state, this.view, colorButton.command));
    }

    buttons.undo.disabled = !canRun(state, this.view, this.commands.undo);
    buttons.redo.disabled = !canRun(state, this.view, this.commands.redo);
    buttons.image.disabled = !this.uploadUrl;
  }
}

export function createMoongladeEditor(options: MoongladeEditorOptions): MoongladeEditor {
  return new MoongladeEditor(options);
}

const colorPalette = [
  { label: 'Dark', value: '#212529' },
  { label: 'Gray', value: '#6c757d' },
  { label: 'Blue', value: '#0d6efd' },
  { label: 'Green', value: '#198754' },
  { label: 'Red', value: '#dc3545' },
  { label: 'Yellow', value: '#ffc107' }
];

function canRun(state: EditorState, view: EditorView, command: Command): boolean {
  return command(state, undefined, view);
}

function canEditLink(state: EditorState, activeLink: Mark | null): boolean {
  return Boolean(activeLink) || !state.selection.empty;
}

function getCurrentFormat(state: EditorState): string {
  const { $from } = state.selection;
  const parent = $from.parent;

  if (parent.type.name === 'heading') {
    return `heading:${parent.attrs.level}`;
  }

  return 'paragraph';
}

function getCurrentAlignment(state: EditorState): string {
  const align = state.selection.$from.parent.attrs.align;
  return typeof align === 'string' && align ? align : 'left';
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

function getActiveMark(state: EditorState, markType: MarkType): Mark | null {
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

function setButtonState(button: HTMLButtonElement, active: boolean, enabled: boolean): void {
  button.classList.toggle('active', active);
  button.setAttribute('aria-pressed', active ? 'true' : 'false');
  button.disabled = !enabled;
}

function getFirstImageFile(files: FileList | null | undefined): File | null {
  return Array.from(files ?? []).find((file) => file.type.startsWith('image/')) ?? null;
}
