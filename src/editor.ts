import { baseKeymap } from 'prosemirror-commands';
import { gapCursor } from 'prosemirror-gapcursor';
import { history, redo, undo } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import type { Node as ProseMirrorNode, Schema } from 'prosemirror-model';
import { EditorState, Plugin, PluginKey, Selection, TextSelection, type Command, type SelectionBookmark, type Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view';
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
import { normalizeCodeSampleLanguages, type CodeSampleLanguageOption } from './editor-options';
import { parseHtml, serializeHtml } from './html';
import {
  createImageUploader,
  formatAllowedImageExtensions,
  hasAllowedImageUploadExtension,
  normalizeAllowedImageExtensions,
  type MoongladeImageUploader
} from './image-upload';
import { moongladeSchema } from './schema';
import { closeColorDropdowns, closeTableDropdown, createToolbar, getFirstClipboardImageFile, getFirstImageFile, type ToolbarElements } from './toolbar';

const DEFAULT_EDITOR_HEIGHT = '500px';
const TEXTAREA_SYNC_DEBOUNCE_MS = 200;
const uploadPreviewPluginKey = new PluginKey<DecorationSet>('moonglade-image-upload-preview');

type UploadPreviewMeta =
  | {
    type: 'add';
    id: number;
    pos: number;
    src: string;
    alt: string;
  }
  | {
    type: 'remove';
    id: number;
  };

interface UploadPreviewHandle {
  id: number;
  objectUrl: string;
}

export interface MoongladeEditorOptions {
  element: HTMLElement;
  textarea?: HTMLTextAreaElement;
  content?: string;
  height?: string;
  spellcheck?: boolean;
  uploadUrl?: string;
  uploadImage?: MoongladeImageUploader;
  allowedImageExtensions?: readonly string[];
  codesample_languages?: readonly CodeSampleLanguageOption[];
  onChange?: (html: string) => void;
}

export class MoongladeEditor {
  readonly schema: Schema;
  readonly commands: MoongladeEditorCommands;
  readonly uploadUrl?: string;

  private readonly textarea?: HTMLTextAreaElement;
  private readonly onChange?: (html: string) => void;
  private readonly uploadImage?: MoongladeImageUploader;
  private readonly allowedImageExtensions: readonly string[];
  private readonly codeSampleLanguages: readonly CodeSampleLanguageOption[];
  private readonly toolbar: ToolbarElements;
  private spellcheck: boolean;
  private readonly closeColorDropdownsOnDocumentPointerDown = (event: PointerEvent): void => {
    const target = event.target;
    if (target instanceof Node && this.toolbar.root.contains(target)) {
      return;
    }

    closeColorDropdowns(this.toolbar);
    closeTableDropdown(this.toolbar);
  };
  private savedSelection?: SelectionBookmark;
  private nextUploadPreviewId = 1;
  private readonly uploadPreviewUrls = new Map<number, string>();
  private view: EditorView;
  private textareaSyncHandle?: ReturnType<typeof setTimeout>;

  constructor(options: MoongladeEditorOptions) {
    this.schema = moongladeSchema;
    this.commands = createCommands(this.schema);
    this.textarea = options.textarea;
    this.uploadUrl = options.uploadUrl;
    this.uploadImage = createImageUploader(options);
    this.allowedImageExtensions = normalizeAllowedImageExtensions(options.allowedImageExtensions);
    this.codeSampleLanguages = normalizeCodeSampleLanguages(options.codesample_languages);
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
      uploadConfigured: Boolean(this.uploadImage) && this.allowedImageExtensions.length > 0,
      allowedImageExtensions: this.allowedImageExtensions,
      codeSampleLanguages: this.codeSampleLanguages,
      actions: {
        execute: (command) => this.execute(command),
        executeWithSavedSelection: (command) => this.executeWithSavedSelection(command),
        saveSelection: () => {
          this.savedSelection = this.view.state.selection.getBookmark();
        },
        openImageDialog: () => this.openImageDialog(),
        closeImageDialog: (restoreSelection) => this.closeImageDialog(restoreSelection),
        openLinkDialog: () => this.openLinkDialog(),
        closeLinkDialog: (restoreSelection) => this.closeLinkDialog(restoreSelection),
        insertCode: () => this.insertCode(),
        openCodeDialog: () => this.openCodeDialog(),
        closeCodeDialog: (restoreSelection) => this.closeCodeDialog(restoreSelection),
        openSourceDialog: () => this.openSourceDialog(),
        closeSourceDialog: (focusEditor) => this.closeSourceDialog(focusEditor),
        applySourceHtml: (html) => this.setHTML(html)
      }
    });
    this.toolbar.imageDialog.fileInput.addEventListener('change', () => this.handleImageDialogFileChange());
    this.toolbar.imageDialog.pasteTarget.addEventListener('paste', (event) => this.handleImageDialogPaste(event));
    document.addEventListener('pointerdown', this.closeColorDropdownsOnDocumentPointerDown);
    options.element.append(this.toolbar.root, editorHost);

    this.view = new EditorView(editorHost, {
      state: EditorState.create({
        doc,
        schema: this.schema,
        plugins: [
          history(),
          gapCursor(),
          createUploadPreviewPlugin(),
          createCodeBlockSpellcheckPlugin(),
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
        },
        paste: (_view, event) => {
          return this.handleImagePaste(event as ClipboardEvent);
        }
      },
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
    this.flushScheduledTextareaSync();
    this.clearUploadPreviewUrls();
    this.view.destroy();
  }

  syncToTextarea(): void {
    this.cancelScheduledTextareaSync();
    this.writeEditorValue(true);
  }

  private scheduleTextareaSync(): void {
    if (this.textareaSyncHandle !== undefined) {
      clearTimeout(this.textareaSyncHandle);
    }

    this.textareaSyncHandle = setTimeout(() => {
      this.textareaSyncHandle = undefined;
      this.writeEditorValue(true);
    }, TEXTAREA_SYNC_DEBOUNCE_MS);
  }

  private cancelScheduledTextareaSync(): void {
    if (this.textareaSyncHandle === undefined) {
      return;
    }

    clearTimeout(this.textareaSyncHandle);
    this.textareaSyncHandle = undefined;
  }

  private flushScheduledTextareaSync(): void {
    if (this.textareaSyncHandle === undefined) {
      return;
    }

    clearTimeout(this.textareaSyncHandle);
    this.textareaSyncHandle = undefined;
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
    const file = getFirstClipboardImageFile(event.clipboardData, this.allowedImageExtensions);

    if (!file) {
      return false;
    }

    event.preventDefault();
    if (!this.uploadImage) {
      this.setUploadStatus('Image upload is not configured.', true);
      return true;
    }

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
    const file = getFirstImageFile(event.dataTransfer?.files, this.allowedImageExtensions);

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

    if (!hasAllowedImageUploadExtension(file, this.allowedImageExtensions)) {
      this.setUploadStatus(this.getUnsupportedImageFormatMessage(), true);
      return false;
    }

    const preview = this.addUploadPreview(file, uploadSelection);
    this.setUploadStatus('Uploading image...');

    try {
      const result = await this.uploadImage(file);
      const inserted = this.executeImageCommand(
        this.commands.insertImage(result.src, result.alt, result.title),
        uploadSelection,
        preview
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
    } finally {
      this.removeUploadPreview(preview);
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
      this.scheduleTextareaSync();
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

  private openImageDialog(): void {
    this.savedSelection = this.view.state.selection.getBookmark();
    const { imageDialog } = this.toolbar;

    imageDialog.root.hidden = false;
    imageDialog.pasteTarget.focus();
  }

  private closeImageDialog(restoreSelection: boolean): void {
    this.toolbar.imageDialog.root.hidden = true;
    this.toolbar.imageDialog.fileInput.value = '';

    if (restoreSelection) {
      this.restoreSavedSelection();
    }

    this.savedSelection = undefined;
    this.view.focus();
    this.updateToolbarState();
  }

  private handleImageDialogFileChange(): void {
    const { fileInput } = this.toolbar.imageDialog;
    const file = getFirstImageFile(fileInput.files, this.allowedImageExtensions);
    fileInput.value = '';

    if (file) {
      this.uploadImageFromSavedSelection(file);
    }
  }

  private handleImageDialogPaste(event: ClipboardEvent): void {
    const file = getFirstClipboardImageFile(event.clipboardData, this.allowedImageExtensions);
    if (!file) {
      return;
    }

    event.preventDefault();
    this.uploadImageFromSavedSelection(file);
  }

  private uploadImageFromSavedSelection(file: File): void {
    const uploadSelection = this.savedSelection ?? this.view.state.selection.getBookmark();
    this.closeImageDialog(false);
    void this.uploadAndInsertImage(file, uploadSelection);
  }

  private insertCode(): void {
    if (this.view.state.selection.empty) {
      this.openCodeDialog();
      return;
    }

    this.execute(this.commands.inlineCode);
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
    sourceDialog.sourceTextarea.setSelectionRange(0, 0);
    sourceDialog.sourceTextarea.scrollTop = 0;
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

  private executeImageCommand(command: Command, selectionBookmark: SelectionBookmark, preview?: UploadPreviewHandle): boolean {
    const previewPosition = preview ? this.getUploadPreviewPosition(preview.id) : undefined;
    if (typeof previewPosition === 'number') {
      return this.executeWithPosition(command, previewPosition);
    }

    return this.executeWithSelection(command, selectionBookmark);
  }

  private executeWithPosition(command: Command, pos: number): boolean {
    const doc = this.view.state.doc;
    const safePos = Math.max(0, Math.min(pos, doc.content.size));
    const resolvedPos = doc.resolve(safePos);
    const selection = resolvedPos.parent.inlineContent
      ? TextSelection.create(doc, safePos)
      : Selection.near(resolvedPos);

    this.view.dispatch(this.view.state.tr.setSelection(selection));
    const result = command(this.view.state, this.view.dispatch, this.view);
    this.view.focus();
    this.updateToolbarState();
    return result;
  }

  private addUploadPreview(file: File, uploadSelection: SelectionBookmark): UploadPreviewHandle | undefined {
    if (!file.type.startsWith('image/')) {
      return undefined;
    }

    const objectUrl = createObjectUrl(file);
    if (!objectUrl) {
      return undefined;
    }

    const id = this.nextUploadPreviewId;
    this.nextUploadPreviewId += 1;
    this.uploadPreviewUrls.set(id, objectUrl);

    const selection = uploadSelection.resolve(this.view.state.doc);
    this.view.dispatch(this.view.state.tr.setMeta(uploadPreviewPluginKey, {
      type: 'add',
      id,
      pos: selection.from,
      src: objectUrl,
      alt: file.name || 'Uploading image'
    } satisfies UploadPreviewMeta));

    return { id, objectUrl };
  }

  private removeUploadPreview(preview: UploadPreviewHandle | undefined): void {
    if (!preview) {
      return;
    }

    this.view.dispatch(this.view.state.tr.setMeta(uploadPreviewPluginKey, {
      type: 'remove',
      id: preview.id
    } satisfies UploadPreviewMeta));
    this.revokeUploadPreviewUrl(preview.id);
  }

  private getUploadPreviewPosition(id: number): number | undefined {
    const decorations = uploadPreviewPluginKey.getState(this.view.state);
    const preview = decorations?.find(undefined, undefined, (spec) => spec.uploadPreviewId === id)[0];
    return preview?.from;
  }

  private revokeUploadPreviewUrl(id: number): void {
    const objectUrl = this.uploadPreviewUrls.get(id);
    if (!objectUrl) {
      return;
    }

    revokeObjectUrl(objectUrl);
    this.uploadPreviewUrls.delete(id);
  }

  private clearUploadPreviewUrls(): void {
    for (const objectUrl of this.uploadPreviewUrls.values()) {
      revokeObjectUrl(objectUrl);
    }

    this.uploadPreviewUrls.clear();
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
    setButtonState(
      buttons.codeBlock,
      state.selection.$from.parent.type === this.schema.nodes.code_block || isMarkActive(state, this.schema.marks.code),
      canRun(state, this.view, state.selection.empty ? this.commands.codeBlock(getCurrentCodeLanguage(state)) : this.commands.inlineCode)
    );
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
    buttons.image.disabled = !this.uploadImage || this.allowedImageExtensions.length === 0;
    buttons.htmlSource.disabled = false;
  }

  private getUnsupportedImageFormatMessage(): string {
    const allowedExtensions = formatAllowedImageExtensions(this.allowedImageExtensions);
    return allowedExtensions
      ? `Image uploads only support ${allowedExtensions}.`
      : 'Image uploads are disabled because no image formats are allowed.';
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

function createUploadPreviewPlugin(): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: uploadPreviewPluginKey,
    state: {
      init: () => DecorationSet.empty,
      apply(transaction, decorations) {
        let nextDecorations = decorations.map(transaction.mapping, transaction.doc);
        const meta = transaction.getMeta(uploadPreviewPluginKey) as UploadPreviewMeta | undefined;

        if (!meta) {
          return nextDecorations;
        }

        if (meta.type === 'remove') {
          return nextDecorations.remove(nextDecorations.find(undefined, undefined, (spec) => spec.uploadPreviewId === meta.id));
        }

        const preview = Decoration.widget(meta.pos, () => {
          const root = document.createElement('span');
          root.className = 'mg-editor-upload-preview';
          root.contentEditable = 'false';

          const image = document.createElement('img');
          image.src = meta.src;
          image.alt = meta.alt;
          root.append(image);

          return root;
        }, {
          key: `mg-editor-upload-preview-${meta.id}`,
          side: -1,
          uploadPreviewId: meta.id
        });

        nextDecorations = nextDecorations.add(transaction.doc, [preview]);
        return nextDecorations;
      }
    },
    props: {
      decorations(state) {
        return uploadPreviewPluginKey.getState(state) ?? null;
      }
    }
  });
}

function createCodeBlockSpellcheckPlugin(): Plugin {
  return new Plugin({
    props: {
      decorations(state) {
        const codeBlockType = state.schema.nodes.code_block;
        const decorations: Decoration[] = [];

        state.doc.descendants((node, pos) => {
          if (node.type !== codeBlockType) {
            return true;
          }

          decorations.push(Decoration.node(pos, pos + node.nodeSize, {
            spellcheck: 'false'
          }));
          return false;
        });

        return DecorationSet.create(state.doc, decorations);
      }
    }
  });
}

function createObjectUrl(file: File): string | undefined {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return undefined;
  }

  return URL.createObjectURL(file);
}

function revokeObjectUrl(objectUrl: string): void {
  if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(objectUrl);
  }
}
