import type { Command } from 'prosemirror-state';
import type { MoongladeEditorCommands } from './commands';
import type { CodeSampleLanguageOption } from './editor-options';
import type { HtmlSourceCodeEditor } from './source-code-editor';

export interface EditorDialogActions {
  executeWithSavedSelection(command: Command): boolean;
  closeLinkDialog(restoreSelection: boolean): void;
  closeCodeDialog(restoreSelection: boolean): void;
  closeImageDialog(restoreSelection: boolean): void;
  closeSourceDialog(focusEditor: boolean): void;
  applySourceHtml(html: string): void;
}

export interface LinkDialogElements {
  root: HTMLDivElement;
  form: HTMLFormElement;
  hrefInput: HTMLInputElement;
  titleInput: HTMLInputElement;
  error: HTMLDivElement;
  removeButton: HTMLButtonElement;
  cancelButton: HTMLButtonElement;
}

export interface CodeDialogElements {
  root: HTMLDivElement;
  form: HTMLFormElement;
  languageSelect: HTMLSelectElement;
  cancelButton: HTMLButtonElement;
}

export interface SourceDialogElements {
  root: HTMLDivElement;
  form: HTMLFormElement;
  findButton: HTMLButtonElement;
  replaceButton: HTMLButtonElement;
  cancelButton: HTMLButtonElement;
  getValue(): string;
  setValue(value: string): Promise<void>;
  focus(): Promise<void>;
  destroy(): void;
}

export interface ImageDialogElements {
  root: HTMLDivElement;
  panel: HTMLDivElement;
  pasteTarget: HTMLDivElement;
  chooseButton: HTMLButtonElement;
  fileInput: HTMLInputElement;
  cancelButton: HTMLButtonElement;
}

export function createLinkDialog(commands: MoongladeEditorCommands, actions: EditorDialogActions): LinkDialogElements {
  const root = document.createElement('div');
  root.className = 'mg-editor-dialog dropdown-menu show p-3 shadow';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Link');

  const form = document.createElement('form');
  form.className = 'mg-editor-dialog-panel d-flex flex-column gap-2';

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
  error.className = 'mg-editor-dialog-error invalid-feedback d-block';
  error.setAttribute('role', 'alert');
  error.hidden = true;

  const actionsElement = document.createElement('div');
  actionsElement.className = 'mg-editor-dialog-actions d-flex justify-content-end gap-2';

  const saveButton = document.createElement('button');
  saveButton.type = 'submit';
  saveButton.className = 'btn btn-primary btn-sm';
  saveButton.textContent = 'Save';

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'btn btn-outline-danger btn-sm';
  removeButton.textContent = 'Remove';
  removeButton.addEventListener('click', () => {
    actions.executeWithSavedSelection(commands.removeLink);
    actions.closeLinkDialog(true);
  });

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className = 'btn btn-outline-secondary btn-sm';
  cancelButton.textContent = 'Cancel';
  cancelButton.addEventListener('click', () => actions.closeLinkDialog(true));

  actionsElement.append(saveButton, removeButton, cancelButton);
  form.append(hrefInput, titleInput, error, actionsElement);
  root.append(form);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const applied = actions.executeWithSavedSelection(commands.link(hrefInput.value, titleInput.value));

    if (!applied) {
      error.textContent = 'Enter a safe link URL.';
      error.hidden = false;
      hrefInput.focus();
      return;
    }

    actions.closeLinkDialog(false);
  });
  closeOnEscape(root, () => actions.closeLinkDialog(true));

  return { root, form, hrefInput, titleInput, error, removeButton, cancelButton };
}

export function createCodeDialog(
  commands: MoongladeEditorCommands,
  actions: EditorDialogActions,
  codeSampleLanguages: readonly CodeSampleLanguageOption[]
): CodeDialogElements {
  const root = document.createElement('div');
  root.className = 'mg-editor-dialog dropdown-menu show p-3 shadow';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Code snippet');

  const form = document.createElement('form');
  form.className = 'mg-editor-dialog-panel d-flex flex-column gap-2';

  const languageSelect = document.createElement('select');
  languageSelect.className = 'form-select form-select-sm';
  languageSelect.name = 'language';
  languageSelect.setAttribute('aria-label', 'Code language');

  for (const language of codeSampleLanguages) {
    const option = document.createElement('option');
    option.value = language.value;
    option.textContent = language.text;
    languageSelect.append(option);
  }

  const actionsElement = document.createElement('div');
  actionsElement.className = 'mg-editor-dialog-actions d-flex justify-content-end gap-2';

  const applyButton = document.createElement('button');
  applyButton.type = 'submit';
  applyButton.className = 'btn btn-primary btn-sm';
  applyButton.textContent = 'Apply';

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className = 'btn btn-outline-secondary btn-sm';
  cancelButton.textContent = 'Cancel';
  cancelButton.addEventListener('click', () => actions.closeCodeDialog(true));

  actionsElement.append(applyButton, cancelButton);
  form.append(languageSelect, actionsElement);
  root.append(form);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    actions.executeWithSavedSelection(commands.codeBlock(languageSelect.value));
    actions.closeCodeDialog(false);
  });
  closeOnEscape(root, () => actions.closeCodeDialog(true));

  return { root, form, languageSelect, cancelButton };
}

export function createImageDialog(
  actions: Pick<EditorDialogActions, 'closeImageDialog'>,
  allowedImageExtensions: readonly string[]
): ImageDialogElements {
  const root = document.createElement('div');
  root.className = 'mg-editor-image-dialog p-3';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Image upload');

  const panel = document.createElement('div');
  panel.className = 'mg-editor-image-panel d-flex flex-column gap-3 p-3';

  const title = document.createElement('h2');
  title.className = 'h6 mb-0';
  title.textContent = 'Image upload';

  const pasteTarget = document.createElement('div');
  pasteTarget.className = 'mg-editor-image-paste-target border rounded p-3 text-center';
  pasteTarget.tabIndex = 0;
  pasteTarget.setAttribute('role', 'button');
  pasteTarget.setAttribute('aria-label', 'Paste image');
  pasteTarget.textContent = 'Paste image here';

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = allowedImageExtensions.join(',');
  fileInput.hidden = true;

  const actionsElement = document.createElement('div');
  actionsElement.className = 'mg-editor-dialog-actions d-flex justify-content-end gap-2';

  const chooseButton = document.createElement('button');
  chooseButton.type = 'button';
  chooseButton.className = 'btn btn-primary btn-sm';
  chooseButton.textContent = 'Choose image';
  chooseButton.addEventListener('click', () => fileInput.click());

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className = 'btn btn-outline-secondary btn-sm';
  cancelButton.textContent = 'Cancel';
  cancelButton.addEventListener('click', () => actions.closeImageDialog(true));

  actionsElement.append(chooseButton, cancelButton);
  panel.append(title, pasteTarget, fileInput, actionsElement);
  root.append(panel);

  root.addEventListener('click', (event) => {
    if (event.target === root) {
      actions.closeImageDialog(true);
    }
  });
  closeOnEscape(root, () => actions.closeImageDialog(true));

  return { root, panel, pasteTarget, chooseButton, fileInput, cancelButton };
}

export function createSourceDialog(actions: EditorDialogActions): SourceDialogElements {
  const root = document.createElement('div');
  root.className = 'mg-editor-source-dialog p-3';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'HTML source');

  const form = document.createElement('form');
  form.className = 'mg-editor-source-panel d-flex flex-column gap-3 p-3';

  const header = document.createElement('div');
  header.className = 'mg-editor-source-header d-flex align-items-center justify-content-between gap-2';

  const title = document.createElement('h2');
  title.className = 'h6 mb-0';
  title.textContent = 'HTML source';

  const sourceToolbar = document.createElement('div');
  sourceToolbar.className = 'btn-group btn-group-sm';
  sourceToolbar.setAttribute('role', 'group');
  sourceToolbar.setAttribute('aria-label', 'Source search');

  const findButton = createSourceActionButton('sourceFind', 'search', 'Find');
  const replaceButton = createSourceActionButton('sourceReplace', 'arrow-left-right', 'Replace');
  sourceToolbar.append(findButton, replaceButton);
  header.append(title, sourceToolbar);

  const sourceEditorHost = document.createElement('div');
  let sourceEditor: HtmlSourceCodeEditor | undefined;
  let sourceEditorPromise: Promise<HtmlSourceCodeEditor> | undefined;
  let currentSourceHtml = '';

  const actionsElement = document.createElement('div');
  actionsElement.className = 'mg-editor-dialog-actions d-flex justify-content-end gap-2';

  const saveButton = document.createElement('button');
  saveButton.type = 'submit';
  saveButton.className = 'btn btn-primary btn-sm';
  saveButton.textContent = 'Save';

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className = 'btn btn-outline-secondary btn-sm';
  cancelButton.textContent = 'Cancel';
  cancelButton.addEventListener('click', () => actions.closeSourceDialog(true));

  actionsElement.append(saveButton, cancelButton);
  form.append(header, sourceEditorHost, actionsElement);
  root.append(form);

  findButton.addEventListener('click', () => {
    void ensureSourceEditor().then((editor) => editor.openSearchPanel('search'));
  });
  replaceButton.addEventListener('click', () => {
    void ensureSourceEditor().then((editor) => editor.openSearchPanel('replace'));
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    actions.applySourceHtml(getValue());
    actions.closeSourceDialog(true);
  });
  closeOnEscape(root, () => actions.closeSourceDialog(true));

  async function ensureSourceEditor(): Promise<HtmlSourceCodeEditor> {
    if (sourceEditor) {
      return sourceEditor;
    }

    sourceEditorPromise ??= import('./source-code-editor').then(({ HtmlSourceCodeEditor }) => {
      const editor = new HtmlSourceCodeEditor();
      sourceEditorHost.replaceChildren(editor.root);
      sourceEditor = editor;
      return editor;
    });

    return sourceEditorPromise;
  }

  function getValue(): string {
    return sourceEditor?.getValue() ?? currentSourceHtml;
  }

  async function setValue(value: string): Promise<void> {
    currentSourceHtml = value;
    const editor = await ensureSourceEditor();
    editor.setValue(value);
  }

  async function focus(): Promise<void> {
    const editor = await ensureSourceEditor();
    editor.focus();
  }

  function destroy(): void {
    sourceEditor?.destroy();
    sourceEditor = undefined;
    sourceEditorPromise = undefined;
  }

  return { root, form, findButton, replaceButton, cancelButton, getValue, setValue, focus, destroy };
}

function createSourceActionButton(command: string, icon: string, label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn btn-outline-secondary mg-editor-toolbar-button mg-editor-icon-button';
  button.dataset.command = command;
  button.title = label;
  button.setAttribute('aria-label', label);

  const iconElement = document.createElement('i');
  iconElement.className = `bi bi-${icon}`;
  iconElement.setAttribute('aria-hidden', 'true');
  button.append(iconElement);

  button.addEventListener('mousedown', (event) => {
    event.preventDefault();
  });

  return button;
}

function closeOnEscape(root: HTMLElement, close: () => void): void {
  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || root.hidden || event.defaultPrevented) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    close();
  });
}
