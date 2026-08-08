import { baseKeymap } from 'prosemirror-commands';
import { gapCursor } from 'prosemirror-gapcursor';
import { history } from 'prosemirror-history';
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
import { createRichHtmlKeyboardShortcutMap } from './keyboard-shortcuts';
import {
  assertHTMLElement,
  assertOptionalBoolean,
  assertOptionalFunction,
  assertOptionalString,
  assertOptionalStringArray,
  assertOptionalTextArea
} from './options-validation';
import { moongladeSchema } from './schema';
import { closeColorDropdowns, closeTableDropdown, createToolbar, getFirstClipboardImageFile, getFirstImageFile, type ToolbarElements } from './toolbar';
import { createUploadPreviewPlugin, UploadPreviewManager, type UploadPreviewHandle } from './upload-preview';

const DEFAULT_EDITOR_HEIGHT = '500px';
const TEXTAREA_SYNC_DEBOUNCE_MS = 200;
const richHtmlEditorValidationContext = 'Moonglade.Editor rich HTML editor';
const codeBlockSpellcheckPluginKey = new PluginKey<DecorationSet>('moonglade-code-block-spellcheck');

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
  private readonly uploadPreviews = new UploadPreviewManager();
  private readonly alignmentCommands: { left: Command; center: Command; right: Command; justify: Command };
  private readonly insertTableCommand: Command;
  private view: EditorView;
  private textareaSyncHandle?: ReturnType<typeof setTimeout>;
  private destroyed = false;

  constructor(options: MoongladeEditorOptions) {
    assertEditorOptions(options);

    this.schema = moongladeSchema;
    this.commands = createCommands(this.schema);
    this.alignmentCommands = {
      left: this.commands.alignment('left'),
      center: this.commands.alignment('center'),
      right: this.commands.alignment('right'),
      justify: this.commands.alignment('justify')
    };
    this.insertTableCommand = this.commands.insertTable();
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
          keymap(createRichHtmlKeyboardShortcutMap(this.commands)),
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
    this.ensureActive();
    return this.view.dom;
  }

  get doc(): ProseMirrorNode {
    this.ensureActive();
    return this.view.state.doc;
  }

  getHTML(): string {
    this.ensureActive();
    return serializeHtml(this.schema, this.view.state.doc);
  }

  setHTML(html: string): void {
    this.ensureActive();
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
    this.ensureActive();
    return command(this.view.state, this.view.dispatch, this.view);
  }

  focus(): void {
    this.ensureActive();
    this.view.focus();
  }

  getSpellcheck(): boolean {
    this.ensureActive();
    return this.spellcheck;
  }

  setSpellcheck(enabled: boolean): void {
    this.ensureActive();
    this.spellcheck = enabled;
    this.view.setProps({
      attributes: this.getEditorAttributes()
    });
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }

    document.removeEventListener('pointerdown', this.closeColorDropdownsOnDocumentPointerDown);
    this.flushScheduledTextareaSync();
    this.uploadPreviews.clear();
    this.toolbar.sourceDialog.destroy();
    this.view.destroy();
    this.destroyed = true;
  }

  syncToTextarea(): void {
    this.ensureActive();
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

    if (!file) {
      return false;
    }

    event.preventDefault();
    if (!this.uploadImage) {
      this.setUploadStatus('Image upload is not configured.', true);
      return true;
    }

    const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
    if (coordinates) {
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, coordinates.pos)));
    }

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

    const preview = this.uploadPreviews.add(this.view, file, uploadSelection);
    this.setUploadStatus('Uploading image...');

    try {
      const result = await this.uploadImage(file);
      if (this.destroyed) {
        return false;
      }

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
      if (this.destroyed) {
        return false;
      }

      const message = error instanceof Error ? error.message : 'Image upload failed.';
      this.setUploadStatus(message, true);
      return false;
    } finally {
      if (!this.destroyed) {
        this.uploadPreviews.remove(this.view, preview);
      }
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

    sourceDialog.root.hidden = false;
    void sourceDialog
      .setValue(this.getHTML())
      .then(() => sourceDialog.focus());
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
    const previewPosition = preview ? this.uploadPreviews.getPosition(this.view, preview.id) : undefined;
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

    const currentAlignment = getCurrentAlignment(state);

    setButtonState(buttons.bold, isMarkActive(state, this.schema.marks.strong), canRun(state, this.view, this.commands.bold));
    setButtonState(buttons.italic, isMarkActive(state, this.schema.marks.em), canRun(state, this.view, this.commands.italic));
    setButtonState(buttons.underline, isMarkActive(state, this.schema.marks.underline), canRun(state, this.view, this.commands.underline));
    setButtonState(buttons.strike, isMarkActive(state, this.schema.marks.strike), canRun(state, this.view, this.commands.strike));
    setButtonState(buttons.blockquote, hasAncestor(state, this.schema.nodes.blockquote), canRun(state, this.view, this.commands.blockquote));
    setButtonState(buttons.bulletList, hasAncestor(state, this.schema.nodes.bullet_list), canRun(state, this.view, this.commands.bulletList));
    setButtonState(buttons.orderedList, hasAncestor(state, this.schema.nodes.ordered_list), canRun(state, this.view, this.commands.orderedList));
    setButtonState(buttons.alignLeft, currentAlignment === 'left', canRun(state, this.view, this.alignmentCommands.left));
    setButtonState(buttons.alignCenter, currentAlignment === 'center', canRun(state, this.view, this.alignmentCommands.center));
    setButtonState(buttons.alignRight, currentAlignment === 'right', canRun(state, this.view, this.alignmentCommands.right));
    setButtonState(buttons.alignJustify, currentAlignment === 'justify', canRun(state, this.view, this.alignmentCommands.justify));
    setButtonState(
      buttons.codeBlock,
      state.selection.$from.parent.type === this.schema.nodes.code_block || isMarkActive(state, this.schema.marks.code),
      canRun(state, this.view, state.selection.empty ? this.commands.codeBlock(getCurrentCodeLanguage(state)) : this.commands.inlineCode)
    );
    setButtonState(buttons.horizontalRule, false, canRun(state, this.view, this.commands.insertHorizontalRule));
    setButtonState(buttons.insertTable, false, canRun(state, this.view, this.insertTableCommand));
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

  private ensureActive(): void {
    if (this.destroyed) {
      throw new Error('Moonglade.Editor rich HTML editor instance has been destroyed.');
    }
  }
}

export function createMoongladeEditor(options: MoongladeEditorOptions): MoongladeEditor {
  return new MoongladeEditor(options);
}

function assertEditorOptions(options: MoongladeEditorOptions): void {
  if (!options || typeof options !== 'object') {
    throw new TypeError('Moonglade.Editor rich HTML editor options must be an object.');
  }

  assertHTMLElement(options.element, richHtmlEditorValidationContext, 'element');
  assertOptionalTextArea(options.textarea, richHtmlEditorValidationContext, 'textarea');
  assertOptionalString(options.content, richHtmlEditorValidationContext, 'content');
  assertOptionalString(options.height, richHtmlEditorValidationContext, 'height');
  assertOptionalBoolean(options.spellcheck, richHtmlEditorValidationContext, 'spellcheck');
  assertOptionalString(options.uploadUrl, richHtmlEditorValidationContext, 'uploadUrl');
  assertOptionalFunction(options.uploadImage, richHtmlEditorValidationContext, 'uploadImage');
  assertOptionalStringArray(options.allowedImageExtensions, richHtmlEditorValidationContext, 'allowedImageExtensions');
  assertOptionalCodeSampleLanguages(options.codesample_languages);
  assertOptionalFunction(options.onChange, richHtmlEditorValidationContext, 'onChange');
}

function assertOptionalCodeSampleLanguages(value: unknown): asserts value is readonly CodeSampleLanguageOption[] | undefined {
  if (value === undefined) {
    return;
  }

  if (!Array.isArray(value) || value.some((item) =>
    !item ||
    typeof item !== 'object' ||
    typeof (item as Partial<CodeSampleLanguageOption>).text !== 'string' ||
    typeof (item as Partial<CodeSampleLanguageOption>).value !== 'string'
  )) {
    throw new TypeError('Moonglade.Editor rich HTML editor codesample_languages must be an array of code sample language options.');
  }
}

function setButtonState(button: HTMLButtonElement, active: boolean, enabled: boolean): void {
  button.classList.toggle('active', active);
  button.setAttribute('aria-pressed', active ? 'true' : 'false');
  button.disabled = !enabled;
}

function buildCodeBlockSpellcheckDecorations(doc: ProseMirrorNode, schema: Schema): DecorationSet {
  const codeBlockType = schema.nodes.code_block;
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (node.type !== codeBlockType) {
      return true;
    }

    decorations.push(Decoration.node(pos, pos + node.nodeSize, {
      spellcheck: 'false'
    }));
    return false;
  });

  return DecorationSet.create(doc, decorations);
}

function createCodeBlockSpellcheckPlugin(): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: codeBlockSpellcheckPluginKey,
    state: {
      init: (_config, state) => buildCodeBlockSpellcheckDecorations(state.doc, state.schema),
      apply(transaction, decorations, _oldState, newState) {
        if (!transaction.docChanged) {
          return decorations;
        }

        return buildCodeBlockSpellcheckDecorations(transaction.doc, newState.schema);
      }
    },
    props: {
      decorations(state) {
        return codeBlockSpellcheckPluginKey.getState(state) ?? null;
      }
    }
  });
}
