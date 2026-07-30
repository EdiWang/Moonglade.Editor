import { closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab
} from '@codemirror/commands';
import {
  bracketMatching,
  foldGutter,
  foldKeymap,
  indentOnInput
} from '@codemirror/language';
import { openSearchPanel, searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { Compartment, EditorState, type Extension } from '@codemirror/state';
import {
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection
} from '@codemirror/view';
import type { MoongladeCodeEditorOptions, MoongladeCodeLanguage } from './code-editor-options';
import { formatCode } from './code-formatter';
import { assertMoongladeCodeLanguage, createLanguageExtension } from './code-languages';
import {
  assertOptionalMarkdownImageUploadOptions,
  createMarkdownImageUploadExtension
} from './markdown-image-upload';
import { createMoongladeCodeEditorTheme } from './code-theme';

const DEFAULT_EDITOR_HEIGHT = '500px';
const DEFAULT_TAB_SIZE = 2;
type StatusTone = 'info' | 'success' | 'error';
type SearchPanelFocusTarget = 'search' | 'replace';

interface ToolbarElements {
  root: HTMLDivElement;
  replaceButton: HTMLButtonElement;
  formatButton: HTMLButtonElement;
}

export class MoongladeCodeEditor {
  private readonly textarea?: HTMLTextAreaElement;
  private readonly onChange?: (value: string) => void;
  private readonly toolbar: ToolbarElements;
  private readonly status: HTMLDivElement;
  private readonly languageCompartment = new Compartment();
  private readonly wrappingCompartment = new Compartment();
  private readonly tabSizeCompartment = new Compartment();
  private readonly readOnlyCompartment = new Compartment();
  private readonly editableCompartment = new Compartment();
  private language: MoongladeCodeLanguage;
  private tabSize: number;
  private readOnly: boolean;
  private view: EditorView;
  private statusHideTimer: number | undefined;
  private destroyed = false;

  constructor(options: MoongladeCodeEditorOptions) {
    assertEditorOptions(options);

    this.textarea = options.textarea;
    this.onChange = options.onChange;
    this.language = options.language;
    this.tabSize = options.tabSize ?? DEFAULT_TAB_SIZE;
    this.readOnly = options.readOnly ?? false;

    const initialContent = options.content ?? options.textarea?.value ?? '';
    this.toolbar = this.createToolbar();
    const host = document.createElement('div');
    host.className = 'mg-code-editor-host';
    this.status = document.createElement('div');
    this.status.className = 'mg-code-editor-status mg-code-editor-status-info';
    this.status.hidden = true;
    this.status.setAttribute('aria-live', 'polite');
    this.status.setAttribute('role', 'status');

    options.element.classList.add('mg-code-editor');
    options.element.style.height = options.height ?? DEFAULT_EDITOR_HEIGHT;
    options.element.replaceChildren(this.toolbar.root, host, this.status);
    this.updateToolbarState();

    this.view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: initialContent,
        extensions: this.createExtensions(options)
      })
    });

    this.syncToTextarea();
  }

  get dom(): HTMLElement {
    this.ensureActive();
    return this.view.dom;
  }

  getValue(): string {
    this.ensureActive();
    return this.view.state.doc.toString();
  }

  setValue(value: string): void {
    this.ensureActive();
    assertString(value, 'value');

    const previousValue = this.getValue();
    this.view.dispatch({
      changes: {
        from: 0,
        to: this.view.state.doc.length,
        insert: value
      }
    });

    if (value === previousValue) {
      this.writeEditorValue(value, false);
    }
  }

  getLanguage(): MoongladeCodeLanguage {
    this.ensureActive();
    return this.language;
  }

  setLanguage(language: MoongladeCodeLanguage): void {
    this.ensureActive();
    assertMoongladeCodeLanguage(language);

    this.language = language;
    this.view.dispatch({
      effects: this.languageCompartment.reconfigure(createLanguageExtension(language))
    });
  }

  setReadOnly(readOnly: boolean): void {
    this.ensureActive();
    assertBoolean(readOnly, 'readOnly');

    this.readOnly = readOnly;
    this.updateToolbarState();
    this.view.dispatch({
      effects: [
        this.readOnlyCompartment.reconfigure(EditorState.readOnly.of(readOnly)),
        this.editableCompartment.reconfigure(EditorView.editable.of(!readOnly))
      ]
    });
  }

  setLineWrapping(enabled: boolean): void {
    this.ensureActive();
    assertBoolean(enabled, 'enabled');

    this.view.dispatch({
      effects: this.wrappingCompartment.reconfigure(enabled ? EditorView.lineWrapping : [])
    });
  }

  async format(): Promise<boolean> {
    this.ensureActive();
    this.showStatus('Formatting...', 'info', 0);

    try {
      const result = await formatCode({
        language: this.language,
        value: this.getValue(),
        tabSize: this.tabSize
      });

      if (!result.changed) {
        this.showStatus('No formatting changes.', 'info', 1800);
        return false;
      }

      this.setValue(result.value);
      this.showStatus('Formatted.', 'success', 1800);
      return true;
    } catch (error) {
      this.showStatus(`Formatting failed: ${getErrorMessage(error)}`, 'error', 6000);
      throw error;
    }
  }

  syncToTextarea(): void {
    this.ensureActive();
    this.writeEditorValue(this.getValue(), false);
  }

  private writeEditorValue(value: string, notifyHost: boolean): void {
    if (this.textarea) {
      this.textarea.value = value;
    }

    if (notifyHost) {
      this.onChange?.(value);
    }
  }

  focus(): void {
    this.ensureActive();
    this.view.focus();
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.view.destroy();
    this.clearStatusTimer();
    this.destroyed = true;
  }

  private createExtensions(options: MoongladeCodeEditorOptions): Extension[] {
    return [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      foldGutter(),
      drawSelection(),
      dropCursor(),
      rectangularSelection(),
      highlightActiveLine(),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      createMoongladeCodeEditorTheme(),
      highlightSelectionMatches(),
      this.languageCompartment.of(createLanguageExtension(this.language)),
      this.tabSizeCompartment.of(EditorState.tabSize.of(this.tabSize)),
      this.wrappingCompartment.of(options.lineWrapping ? EditorView.lineWrapping : []),
      this.readOnlyCompartment.of(EditorState.readOnly.of(this.readOnly)),
      this.editableCompartment.of(EditorView.editable.of(!this.readOnly)),
      createMarkdownImageUploadExtension(options.markdownImageUpload, () => this.language, {
        onUploadStart: (files) => {
          this.showStatus(`Uploading ${formatImageCount(files.length)}...`, 'info', 0);
        },
        onUploadError: (error) => {
          this.showStatus(`Image upload failed: ${getErrorMessage(error)}`, 'error', 6000);
        },
        onUploadComplete: ({ uploadedFiles, failedFiles }) => {
          if (failedFiles.length > 0) {
            if (uploadedFiles.length > 0) {
              this.showStatus(
                `Uploaded ${formatImageCount(uploadedFiles.length)}. ${formatImageCount(failedFiles.length)} failed.`,
                'error',
                6000
              );
            }
            return;
          }

          if (uploadedFiles.length > 0) {
            this.showStatus(`Inserted ${formatImageCount(uploadedFiles.length)}.`, 'success', 1800);
          }
        }
      }),
      EditorView.updateListener.of((update) => {
        if (!update.docChanged) {
          return;
        }

        this.writeEditorValue(update.state.doc.toString(), true);
      }),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...searchKeymap,
        ...completionKeymap,
        indentWithTab
      ])
    ];
  }

  private ensureActive(): void {
    if (this.destroyed) {
      throw new Error('Moonglade.Editor code editor instance has been destroyed.');
    }
  }

  private createToolbar(): ToolbarElements {
    const root = document.createElement('div');
    root.className = 'mg-code-editor-toolbar';
    root.setAttribute('role', 'toolbar');
    root.setAttribute('aria-label', 'Code editor toolbar');

    const searchGroup = createToolbarButtonGroup('Search and replace');
    const searchButton = createToolbarButton('search', 'Find');
    searchButton.addEventListener('click', () => {
      this.openSearchPanel('search');
    });

    const replaceButton = createToolbarButton('replace', 'Replace');
    replaceButton.addEventListener('click', () => {
      this.openSearchPanel('replace');
    });
    searchGroup.append(searchButton, replaceButton);

    const formatGroup = createToolbarButtonGroup('Formatting');
    const formatButton = createToolbarButton('format', 'Format');
    formatButton.addEventListener('click', () => {
      void this.format().catch(() => undefined);
    });
    formatGroup.append(formatButton);

    root.append(searchGroup, formatGroup);

    return {
      root,
      replaceButton,
      formatButton
    };
  }

  private updateToolbarState(): void {
    this.toolbar.replaceButton.disabled = this.readOnly;
    this.toolbar.formatButton.disabled = this.readOnly;
  }

  private openSearchPanel(focusTarget: SearchPanelFocusTarget): void {
    this.ensureActive();
    openSearchPanel(this.view);
    this.focusSearchPanelField(focusTarget);
  }

  private focusSearchPanelField(focusTarget: SearchPanelFocusTarget): void {
    const focus = () => {
      const field =
        this.view.dom.querySelector<HTMLInputElement>(`.cm-search input[name="${focusTarget}"]`) ??
        this.view.dom.querySelector<HTMLInputElement>('.cm-search input');

      field?.focus();
      field?.select();
    };

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(focus);
      return;
    }

    focus();
  }

  private showStatus(message: string, tone: StatusTone, autoHideMs: number): void {
    if (this.destroyed) {
      return;
    }

    this.clearStatusTimer();
    this.status.className = `mg-code-editor-status mg-code-editor-status-${tone}`;
    this.status.textContent = message;
    this.status.hidden = false;
    this.status.setAttribute('aria-live', tone === 'error' ? 'assertive' : 'polite');
    this.status.setAttribute('role', tone === 'error' ? 'alert' : 'status');

    if (tone === 'error' && typeof this.status.scrollIntoView === 'function') {
      this.status.scrollIntoView({
        block: 'nearest'
      });
    }

    if (autoHideMs > 0 && typeof window !== 'undefined') {
      this.statusHideTimer = window.setTimeout(() => {
        this.status.hidden = true;
        this.status.textContent = '';
        this.statusHideTimer = undefined;
      }, autoHideMs);
    }
  }

  private clearStatusTimer(): void {
    if (this.statusHideTimer === undefined || typeof window === 'undefined') {
      return;
    }

    window.clearTimeout(this.statusHideTimer);
    this.statusHideTimer = undefined;
  }
}

export function createMoongladeCodeEditor(options: MoongladeCodeEditorOptions): MoongladeCodeEditor {
  return new MoongladeCodeEditor(options);
}

function assertEditorOptions(options: MoongladeCodeEditorOptions): void {
  if (!options || typeof options !== 'object') {
    throw new TypeError('Moonglade.Editor code editor options must be an object.');
  }

  assertHTMLElement(options.element, 'element');
  assertOptionalTextArea(options.textarea, 'textarea');
  assertOptionalString(options.content, 'content');
  assertMoongladeCodeLanguage(options.language);
  assertOptionalString(options.height, 'height');
  assertOptionalBoolean(options.lineWrapping, 'lineWrapping');
  assertOptionalTabSize(options.tabSize);
  assertOptionalBoolean(options.readOnly, 'readOnly');
  assertOptionalMarkdownImageUploadOptions(options.markdownImageUpload);
  assertOptionalFunction(options.onChange, 'onChange');
}

function assertHTMLElement(value: unknown, name: string): asserts value is HTMLElement {
  if (typeof HTMLElement === 'undefined' || !(value instanceof HTMLElement)) {
    throw new TypeError(`Moonglade.Editor code editor ${name} must be an HTMLElement.`);
  }
}

function assertOptionalTextArea(value: unknown, name: string): asserts value is HTMLTextAreaElement | undefined {
  if (
    value !== undefined &&
    (typeof HTMLTextAreaElement === 'undefined' || !(value instanceof HTMLTextAreaElement))
  ) {
    throw new TypeError(`Moonglade.Editor code editor ${name} must be an HTMLTextAreaElement.`);
  }
}

function assertString(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string') {
    throw new TypeError(`Moonglade.Editor code editor ${name} must be a string.`);
  }
}

function assertOptionalString(value: unknown, name: string): asserts value is string | undefined {
  if (value !== undefined) {
    assertString(value, name);
  }
}

function assertBoolean(value: unknown, name: string): asserts value is boolean {
  if (typeof value !== 'boolean') {
    throw new TypeError(`Moonglade.Editor code editor ${name} must be a boolean.`);
  }
}

function assertOptionalBoolean(value: unknown, name: string): asserts value is boolean | undefined {
  if (value !== undefined) {
    assertBoolean(value, name);
  }
}

function assertOptionalTabSize(value: unknown): asserts value is number | undefined {
  if (value === undefined) {
    return;
  }

  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new TypeError('Moonglade.Editor code editor tabSize must be a positive integer.');
  }
}

function assertOptionalFunction(value: unknown, name: string): asserts value is ((value: string) => void) | undefined {
  if (value !== undefined && typeof value !== 'function') {
    throw new TypeError(`Moonglade.Editor code editor ${name} must be a function.`);
  }
}

function createToolbarButtonGroup(ariaLabel: string): HTMLDivElement {
  const group = document.createElement('div');
  group.className = 'mg-code-editor-toolbar-group';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', ariaLabel);
  return group;
}

function createToolbarButton(command: string, label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'mg-code-editor-toolbar-button';
  button.dataset.command = command;
  button.title = label;
  button.setAttribute('aria-label', label);
  button.textContent = label;
  button.addEventListener('mousedown', (event) => {
    event.preventDefault();
  });
  return button;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error.length > 0) {
    return error;
  }

  return 'Unexpected error.';
}

function formatImageCount(count: number): string {
  return count === 1 ? '1 image' : `${count} images`;
}
