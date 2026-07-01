import { baseKeymap } from 'prosemirror-commands';
import { gapCursor } from 'prosemirror-gapcursor';
import { history, redo, undo } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import type { Node as ProseMirrorNode, Schema } from 'prosemirror-model';
import { EditorState, TextSelection, type Command, type SelectionBookmark, type Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { tableEditing } from 'prosemirror-tables';
import { createCommands, type MoongladeEditorCommands } from './commands';
import {
  canEditLink,
  canRun,
  firstCommand,
  getActiveMark,
  getCurrentAlignment,
  getCurrentCodeLanguage,
  getCurrentFormat,
  getPaletteColor,
  hasAncestor,
  isMarkActive
} from './editor-state';
import { parseHtml, serializeHtml } from './html';
import { moongladeSchema } from './schema';
import { closeColorDropdowns, createToolbar, getFirstImageFile, type ToolbarElements } from './toolbar';

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
  private readonly toolbar: ToolbarElements;
  private readonly closeColorDropdownsOnDocumentPointerDown = (event: PointerEvent): void => {
    const target = event.target;
    if (target instanceof Node && this.toolbar.root.contains(target)) {
      return;
    }

    closeColorDropdowns(this.toolbar);
  };
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
    editorHost.className = 'mg-editor-body card-body d-flex flex-grow-1 p-0';

    options.element.classList.add('mg-editor', 'card', 'd-flex', 'flex-column', 'overflow-hidden');
    options.element.replaceChildren();

    this.toolbar = createToolbar({
      schema: this.schema,
      commands: this.commands,
      uploadConfigured: Boolean(this.uploadUrl),
      actions: {
        execute: (command) => this.execute(command),
        executeWithSavedSelection: (command) => this.executeWithSavedSelection(command),
        saveSelection: () => {
          this.savedSelection = this.view.state.selection.getBookmark();
        },
        uploadFile: (file) => {
          void this.uploadAndInsertImage(file);
        },
        openLinkDialog: () => this.openLinkDialog(),
        closeLinkDialog: (restoreSelection) => this.closeLinkDialog(restoreSelection),
        openCodeDialog: () => this.openCodeDialog(),
        closeCodeDialog: (restoreSelection) => this.closeCodeDialog(restoreSelection),
        openSourceDialog: () => this.openSourceDialog(),
        closeSourceDialog: (focusEditor) => this.closeSourceDialog(focusEditor),
        applySourceHtml: (html) => this.setHTML(html)
      }
    });
    document.addEventListener('pointerdown', this.closeColorDropdownsOnDocumentPointerDown);
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
    document.removeEventListener('pointerdown', this.closeColorDropdownsOnDocumentPointerDown);
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
    this.toolbar.uploadStatus.classList.toggle('text-body-secondary', !isError);
    this.toolbar.uploadStatus.classList.toggle('text-danger', isError);
  }

  private dispatch(transaction: Transaction): void {
    this.view.updateState(this.view.state.apply(transaction));
    if (transaction.docChanged) {
      this.syncToTextarea();
    }

    this.updateToolbarState();
  }

  private execute(command: Command): void {
    command(this.view.state, this.view.dispatch, this.view);
    this.view.focus();
    this.updateToolbarState();
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

  private openCodeDialog(): void {
    this.savedSelection = this.view.state.selection.getBookmark();
    const { codeDialog } = this.toolbar;

    codeDialog.languageSelect.value = getCurrentCodeLanguage(this.view.state);
    codeDialog.root.hidden = false;
    codeDialog.languageSelect.focus();
  }

  private closeCodeDialog(restoreSelection: boolean): void {
    this.toolbar.codeDialog.root.hidden = true;

    if (restoreSelection) {
      this.restoreSavedSelection();
    }

    this.savedSelection = undefined;
    this.view.focus();
    this.updateToolbarState();
  }

  private openSourceDialog(): void {
    const { sourceDialog } = this.toolbar;

    sourceDialog.sourceTextarea.value = this.getHTML();
    sourceDialog.root.hidden = false;
    sourceDialog.sourceTextarea.focus();
    sourceDialog.sourceTextarea.select();
  }

  private closeSourceDialog(focusEditor: boolean): void {
    this.toolbar.sourceDialog.root.hidden = true;

    if (focusEditor) {
      this.view.focus();
    }

    this.updateToolbarState();
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
    const { buttons, colorDropdowns, formatSelect } = this.toolbar;
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
    setButtonState(buttons.codeBlock, state.selection.$from.parent.type === this.schema.nodes.code_block, canRun(state, this.view, this.commands.codeBlock(getCurrentCodeLanguage(state))));
    setButtonState(buttons.insertTable, false, canRun(state, this.view, this.commands.insertTable()));
    setButtonState(buttons.addTableRow, false, canRun(state, this.view, this.commands.addTableRow));
    setButtonState(buttons.deleteTableRow, false, canRun(state, this.view, this.commands.deleteTableRow));
    setButtonState(buttons.addTableColumn, false, canRun(state, this.view, this.commands.addTableColumn));
    setButtonState(buttons.deleteTableColumn, false, canRun(state, this.view, this.commands.deleteTableColumn));
    setButtonState(buttons.toggleTableHeaderRow, false, canRun(state, this.view, this.commands.toggleTableHeaderRow));
    setButtonState(buttons.deleteTable, false, canRun(state, this.view, this.commands.deleteTable));
    setButtonState(buttons.link, Boolean(activeLink), canEditLink(state, activeLink));
    setButtonState(buttons.removeLink, false, Boolean(activeLink));

    for (const colorDropdown of colorDropdowns) {
      const activeColor = getActiveMark(state, colorDropdown.markType)?.attrs.color;
      const paletteColor = getPaletteColor(activeColor, colorDropdown.commands);
      const enabled = canRun(state, this.view, firstCommand(colorDropdown.commands) ?? colorDropdown.clearCommand);
      setButtonState(colorDropdown.button, Boolean(paletteColor), enabled);
      colorDropdown.preview.style.setProperty('--mg-editor-active-color', paletteColor || 'transparent');
      colorDropdown.clearButton.disabled = !canRun(state, this.view, colorDropdown.clearCommand);

      for (const [color, button] of colorDropdown.colorButtons) {
        setButtonState(button, color === paletteColor, canRun(state, this.view, colorDropdown.commands.get(color) ?? colorDropdown.clearCommand));
      }
    }

    buttons.undo.disabled = !canRun(state, this.view, this.commands.undo);
    buttons.redo.disabled = !canRun(state, this.view, this.commands.redo);
    buttons.image.disabled = !this.uploadUrl;
    buttons.htmlSource.disabled = false;
  }
}

export function createMoongladeEditor(options: MoongladeEditorOptions): MoongladeEditor {
  return new MoongladeEditor(options);
}

function setButtonState(button: HTMLButtonElement, active: boolean, enabled: boolean): void {
  button.classList.toggle('active', active);
  button.setAttribute('aria-pressed', active ? 'true' : 'false');
  button.disabled = !enabled;
}
