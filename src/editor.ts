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
import { createImageUploader, type MoongladeImageUploader } from './image-upload';
import { moongladeSchema } from './schema';
import { closeColorDropdowns, createToolbar, getFirstImageFile, type ToolbarElements } from './toolbar';

const DEFAULT_EDITOR_HEIGHT = '500px';

export interface MoongladeEditorOptions {
  element: HTMLElement;
  textarea?: HTMLTextAreaElement;
  content?: string;
  height?: string;
  spellcheck?: boolean;
  uploadUrl?: string;
  uploadImage?: MoongladeImageUploader;
  onChange?: (html: string) => void;
}

export class MoongladeEditor {
  readonly schema: Schema;
  readonly commands: MoongladeEditorCommands;
  readonly uploadUrl?: string;

  private readonly textarea?: HTMLTextAreaElement;
  private readonly onChange?: (html: string) => void;
  private readonly uploadImage?: MoongladeImageUploader;
  private readonly toolbar: ToolbarElements;
  private spellcheck: boolean;
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
    this.schema = moongladeSchema;
    this.commands = createCommands(this.schema);
    this.textarea = options.textarea;
    this.uploadUrl = options.uploadUrl;
    this.uploadImage = createImageUploader(options);
    this.onChange = options.onChange;
    this.spellcheck = options.spellcheck ?? true;

    const initialContent = options.content ?? options.textarea?.value ?? '';
    const doc = parseHtml(this.schema, initialContent);
    const editorHost = document.createElement('div');
    editorHost.className = 'mg-editor-body card-body d-flex flex-grow-1 p-0';

    options.element.classList.add('mg-editor', 'card', 'd-flex', 'flex-column', 'overflow-hidden');
    options.element.style.height = options.height ?? DEFAULT_EDITOR_HEIGHT;
    options.element.replaceChildren();

    this.toolbar = createToolbar({
      schema: this.schema,
      commands: this.commands,
      uploadConfigured: Boolean(this.uploadImage),
      actions: {
        execute: (command) => this.execute(command),
        executeWithSavedSelection: (command) => this.executeWithSavedSelection(command),
        saveSelection: () => {
          this.savedSelection = this.view.state.selection.getBookmark();
        },
        uploadFile: (file) => {
          const uploadSelection = this.savedSelection ?? this.view.state.selection.getBookmark();
          this.savedSelection = undefined;
          void this.uploadAndInsertImage(file, uploadSelection);
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
      attributes: this.getEditorAttributes(),
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

    this.writeEditorValue(false);
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

  getSpellcheck(): boolean {
    return this.spellcheck;
  }

  setSpellcheck(enabled: boolean): void {
    this.spellcheck = enabled;
    this.view.setProps({
      attributes: this.getEditorAttributes()
    });
  }

  destroy(): void {
    document.removeEventListener('pointerdown', this.closeColorDropdownsOnDocumentPointerDown);
    this.view.destroy();
  }

  syncToTextarea(): void {
    this.writeEditorValue(true);
  }

  private writeEditorValue(notifyHost: boolean): void {
    const html = this.getHTML();
    if (this.textarea) {
      this.textarea.value = html;
      if (notifyHost) {
        this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }

    if (notifyHost) {
      this.onChange?.(html);
    }
  }

  private handleImagePaste(event: ClipboardEvent): boolean {
    const file = getFirstImageFile(event.clipboardData?.files);

    if (!file || !this.uploadImage) {
      return false;
    }

    event.preventDefault();
    const uploadSelection = this.view.state.selection.getBookmark();
    void this.uploadAndInsertImage(file, uploadSelection);
    return true;
  }

  private getEditorAttributes(): Record<string, string> {
    return {
      spellcheck: this.spellcheck ? 'true' : 'false'
    };
  }

  private handleImageDrop(view: EditorView, event: DragEvent): boolean {
    const file = getFirstImageFile(event.dataTransfer?.files);

    if (!file || !this.uploadImage) {
      return false;
    }

    const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
    if (coordinates) {
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, coordinates.pos)));
    }

    event.preventDefault();
    const uploadSelection = this.view.state.selection.getBookmark();
    void this.uploadAndInsertImage(file, uploadSelection);
    return true;
  }

  private async uploadAndInsertImage(file: File, uploadSelection: SelectionBookmark): Promise<boolean> {
    if (!this.uploadImage) {
      this.setUploadStatus('Image upload is not configured.', true);
      return false;
    }

    this.setUploadStatus('Uploading image...');

    try {
      const result = await this.uploadImage(file);
      const inserted = this.executeWithSelection(
        this.commands.insertImage(result.src, result.alt, result.title),
        uploadSelection
      );

      if (!inserted) {
        throw new Error('The uploaded image response did not include a safe image URL.');
      }

      this.setUploadStatus('');
      return true;
    } catch (error) {
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
    return this.executeWithSelection(command, this.savedSelection);
  }

  private executeWithSelection(command: Command, selectionBookmark?: SelectionBookmark): boolean {
    this.restoreSelection(selectionBookmark);
    const result = command(this.view.state, this.view.dispatch, this.view);
    this.view.focus();
    this.updateToolbarState();
    return result;
  }

  private restoreSavedSelection(): void {
    this.restoreSelection(this.savedSelection);
  }

  private restoreSelection(selectionBookmark?: SelectionBookmark): void {
    if (!selectionBookmark) {
      return;
    }

    const selection = selectionBookmark.resolve(this.view.state.doc);
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
    setButtonState(buttons.horizontalRule, false, canRun(state, this.view, this.commands.insertHorizontalRule));
    setButtonState(buttons.insertTable, false, canRun(state, this.view, this.commands.insertTable()));
    setButtonState(buttons.addTableRow, false, canRun(state, this.view, this.commands.addTableRow));
    setButtonState(buttons.deleteTableRow, false, canRun(state, this.view, this.commands.deleteTableRow));
    setButtonState(buttons.addTableColumn, false, canRun(state, this.view, this.commands.addTableColumn));
    setButtonState(buttons.deleteTableColumn, false, canRun(state, this.view, this.commands.deleteTableColumn));
    setButtonState(buttons.toggleTableHeaderRow, false, canRun(state, this.view, this.commands.toggleTableHeaderRow));
    setButtonState(buttons.deleteTable, false, canRun(state, this.view, this.commands.deleteTable));
    setButtonState(buttons.link, Boolean(activeLink), canEditLink(state, activeLink));

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
    buttons.image.disabled = !this.uploadImage;
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
