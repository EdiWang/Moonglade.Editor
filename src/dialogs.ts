import type { Command } from 'prosemirror-state';
import type { MoongladeEditorCommands } from './commands';
import { codeLanguages } from './editor-options';

export interface EditorDialogActions {
  executeWithSavedSelection(command: Command): boolean;
  closeLinkDialog(restoreSelection: boolean): void;
  closeCodeDialog(restoreSelection: boolean): void;
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
  sourceTextarea: HTMLTextAreaElement;
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

  return { root, form, hrefInput, titleInput, error, removeButton, cancelButton };
}

export function createCodeDialog(commands: MoongladeEditorCommands, actions: EditorDialogActions): CodeDialogElements {
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

  for (const language of codeLanguages) {
    const option = document.createElement('option');
    option.value = language.value;
    option.textContent = language.label;
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

  return { root, form, languageSelect, cancelButton };
}

export function createSourceDialog(actions: EditorDialogActions): SourceDialogElements {
  const root = document.createElement('div');
  root.className = 'mg-editor-dialog mg-editor-source-dialog dropdown-menu show p-3 shadow';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'HTML source');

  const form = document.createElement('form');
  form.className = 'mg-editor-dialog-panel d-flex flex-column gap-2';

  const sourceTextarea = document.createElement('textarea');
  sourceTextarea.className = 'mg-editor-source-textarea form-control form-control-sm';
  sourceTextarea.name = 'source';
  sourceTextarea.spellcheck = false;
  sourceTextarea.setAttribute('aria-label', 'HTML source');

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
  form.append(sourceTextarea, actionsElement);
  root.append(form);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    actions.applySourceHtml(sourceTextarea.value);
    actions.closeSourceDialog(false);
  });

  return { root, form, sourceTextarea, cancelButton };
}
