import type { MarkType, Schema } from 'prosemirror-model';
import type { Command } from 'prosemirror-state';
import type { MoongladeEditorCommands } from './commands';
import {
  createCodeDialog,
  createLinkDialog,
  createSourceDialog,
  type CodeDialogElements,
  type EditorDialogActions,
  type LinkDialogElements,
  type SourceDialogElements
} from './dialogs';
import { blockFormats, colorPalette } from './editor-options';

export type ToolbarButtonId =
  | 'undo'
  | 'redo'
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'blockquote'
  | 'bulletList'
  | 'orderedList'
  | 'alignLeft'
  | 'alignCenter'
  | 'alignRight'
  | 'alignJustify'
  | 'codeBlock'
  | 'insertTable'
  | 'addTableRow'
  | 'deleteTableRow'
  | 'addTableColumn'
  | 'deleteTableColumn'
  | 'toggleTableHeaderRow'
  | 'deleteTable'
  | 'link'
  | 'image'
  | 'htmlSource';

export type ToolbarButtons = Record<ToolbarButtonId, HTMLButtonElement>;

export interface ToolbarElements {
  root: HTMLDivElement;
  formatSelect: HTMLSelectElement;
  buttons: ToolbarButtons;
  colorDropdowns: ColorDropdown[];
  imageInput: HTMLInputElement;
  uploadStatus: HTMLDivElement;
  linkDialog: LinkDialogElements;
  codeDialog: CodeDialogElements;
  sourceDialog: SourceDialogElements;
}

export interface ColorDropdown {
  button: HTMLButtonElement;
  preview: HTMLSpanElement;
  menu: HTMLDivElement;
  markType: MarkType;
  commands: Map<string, Command>;
  colorButtons: Map<string, HTMLButtonElement>;
  clearButton: HTMLButtonElement;
  clearCommand: Command;
}

interface CreateToolbarOptions {
  schema: Schema;
  commands: MoongladeEditorCommands;
  uploadConfigured: boolean;
  actions: ToolbarActions;
}

interface ToolbarActions extends EditorDialogActions {
  execute(command: Command): void;
  saveSelection(): void;
  uploadFile(file: File): void;
  openLinkDialog(): void;
  openCodeDialog(): void;
  openSourceDialog(): void;
}

export function createToolbar({ schema, commands, uploadConfigured, actions }: CreateToolbarOptions): ToolbarElements {
  const root = document.createElement('div');
  root.className = 'mg-editor-toolbar card-header btn-toolbar gap-2 p-2';
  root.setAttribute('role', 'toolbar');
  root.setAttribute('aria-label', 'Editor toolbar');

  const formatSelect = document.createElement('select');
  formatSelect.className = 'mg-editor-format form-select form-select-sm';
  formatSelect.setAttribute('aria-label', 'Block format');

  for (const format of blockFormats) {
    const option = document.createElement('option');
    option.value = format.value;
    option.textContent = format.label;
    formatSelect.append(option);
  }

  formatSelect.addEventListener('change', () => {
    const [type, level] = formatSelect.value.split(':');
    actions.execute(type === 'heading'
      ? commands.heading(Number(level))
      : commands.paragraph);
  });

  const buttons = {} as ToolbarButtons;
  const colorDropdowns: ColorDropdown[] = [];
  const localCloseColorDropdowns = (except?: ColorDropdown): void => {
    closeColorDropdowns({ colorDropdowns }, except);
  };
  const localToggleColorDropdown = (dropdown: ColorDropdown): void => {
    const shouldOpen = dropdown.menu.hidden;
    localCloseColorDropdowns(dropdown);
    dropdown.menu.hidden = !shouldOpen;
    dropdown.button.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
  };

  const addGroup = (...items: Array<[ToolbarButtonId, string, string, Command]>): void => {
    const group = document.createElement('div');
    group.className = 'btn-group btn-group-sm';
    group.setAttribute('role', 'group');

    for (const [name, icon, ariaLabel, command] of items) {
      const button = createToolbarButton(name, icon, ariaLabel);
      button.addEventListener('click', () => actions.execute(command));

      buttons[name] = button;
      group.append(button);
    }

    root.append(group);
  };

  const formatGroup = document.createElement('div');
  formatGroup.className = 'mg-editor-format-group input-group input-group-sm';
  formatGroup.append(formatSelect);

  addGroup(
    ['undo', 'arrow-counterclockwise', 'Undo', commands.undo],
    ['redo', 'arrow-clockwise', 'Redo', commands.redo]
  );
  root.append(formatGroup);
  addGroup(
    ['bold', 'type-bold', 'Bold', commands.bold],
    ['italic', 'type-italic', 'Italic', commands.italic],
    ['underline', 'type-underline', 'Underline', commands.underline],
    ['strike', 'type-strikethrough', 'Strikethrough', commands.strike]
  );
  addGroup(
    ['blockquote', 'quote', 'Blockquote', commands.blockquote],
    ['bulletList', 'list-ul', 'Bullet list', commands.bulletList],
    ['orderedList', 'list-ol', 'Numbered list', commands.orderedList]
  );
  addGroup(
    ['alignLeft', 'text-left', 'Align left', commands.alignment('left')],
    ['alignCenter', 'text-center', 'Align center', commands.alignment('center')],
    ['alignRight', 'text-right', 'Align right', commands.alignment('right')],
    ['alignJustify', 'justify', 'Justify text', commands.alignment('justify')]
  );

  const insertGroup = document.createElement('div');
  insertGroup.className = 'btn-group btn-group-sm';
  insertGroup.setAttribute('role', 'group');

  const imageButton = createToolbarButton('image', 'image', 'Upload image');
  const imageInput = document.createElement('input');
  imageInput.type = 'file';
  imageInput.accept = 'image/*';
  imageInput.hidden = true;
  imageButton.disabled = !uploadConfigured;
  imageButton.addEventListener('click', () => {
    actions.saveSelection();
    imageInput.click();
  });
  imageInput.addEventListener('change', () => {
    const file = getFirstImageFile(imageInput.files);
    imageInput.value = '';

    if (file) {
      actions.uploadFile(file);
    }
  });
  buttons.image = imageButton;

  const linkButton = createToolbarButton('link', 'link-45deg', 'Add or edit link');
  linkButton.addEventListener('click', () => actions.openLinkDialog());
  buttons.link = linkButton;

  const codeButton = createToolbarButton('codeBlock', 'code-slash', 'Code snippet');
  codeButton.addEventListener('click', () => actions.openCodeDialog());
  buttons.codeBlock = codeButton;

  insertGroup.append(imageButton, imageInput, linkButton, codeButton);
  root.append(insertGroup);

  addGroup(
    ['insertTable', 'table', 'Insert table', commands.insertTable()],
    ['addTableRow', 'plus-lg', 'Add table row', commands.addTableRow],
    ['deleteTableRow', 'dash-lg', 'Delete table row', commands.deleteTableRow],
    ['addTableColumn', 'plus-square', 'Add table column', commands.addTableColumn],
    ['deleteTableColumn', 'dash-square', 'Delete table column', commands.deleteTableColumn],
    ['toggleTableHeaderRow', 'layout-three-columns', 'Toggle table header row', commands.toggleTableHeaderRow],
    ['deleteTable', 'trash', 'Delete table', commands.deleteTable]
  );

  const colorGroup = document.createElement('div');
  colorGroup.className = 'mg-editor-color-group btn-group btn-group-sm';
  colorGroup.setAttribute('role', 'group');
  colorGroup.setAttribute('aria-label', 'Text colors');
  colorGroup.append(
    createColorDropdown({
      label: 'Text color',
      symbol: 'A',
      markType: schema.marks.text_color,
      commandFactory: (color) => commands.textColor(color),
      clearCommand: commands.clearTextColor,
      colorDropdowns,
      actions,
      closeColorDropdowns: localCloseColorDropdowns,
      toggleColorDropdown: localToggleColorDropdown
    }),
    createColorDropdown({
      label: 'Background color',
      symbol: 'ab',
      markType: schema.marks.background_color,
      commandFactory: (color) => commands.backgroundColor(color),
      clearCommand: commands.clearBackgroundColor,
      colorDropdowns,
      actions,
      closeColorDropdowns: localCloseColorDropdowns,
      toggleColorDropdown: localToggleColorDropdown
    })
  );
  root.append(colorGroup);

  const uploadStatus = document.createElement('div');
  uploadStatus.className = 'mg-editor-upload-status small text-body-secondary align-self-center';
  uploadStatus.setAttribute('role', 'status');
  uploadStatus.setAttribute('aria-live', 'polite');
  uploadStatus.hidden = true;
  root.append(uploadStatus);

  const sourceGroup = document.createElement('div');
  sourceGroup.className = 'btn-group btn-group-sm';
  sourceGroup.setAttribute('role', 'group');
  const sourceButton = createToolbarButton('htmlSource', 'filetype-html', 'Edit HTML source');
  sourceButton.addEventListener('click', () => actions.openSourceDialog());
  buttons.htmlSource = sourceButton;
  sourceGroup.append(sourceButton);
  root.append(sourceGroup);

  const linkDialog = createLinkDialog(commands, actions);
  const codeDialog = createCodeDialog(commands, actions);
  const sourceDialog = createSourceDialog(actions);
  root.append(linkDialog.root, codeDialog.root, sourceDialog.root);

  return { root, formatSelect, buttons, colorDropdowns, imageInput, uploadStatus, linkDialog, codeDialog, sourceDialog };
}

export function closeColorDropdowns(toolbar: Pick<ToolbarElements, 'colorDropdowns'>, except?: ColorDropdown): void {
  for (const dropdown of toolbar.colorDropdowns) {
    if (dropdown === except) {
      continue;
    }

    dropdown.menu.hidden = true;
    dropdown.button.setAttribute('aria-expanded', 'false');
  }
}

export function getFirstImageFile(files: FileList | null | undefined): File | null {
  return Array.from(files ?? []).find((file) => file.type.startsWith('image/')) ?? null;
}

function createToolbarButton(name: ToolbarButtonId, icon: string, ariaLabel: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'mg-editor-toolbar-button mg-editor-icon-button btn btn-outline-secondary';
  button.dataset.command = name;
  button.setAttribute('aria-label', ariaLabel);
  button.setAttribute('aria-pressed', 'false');
  button.title = ariaLabel;
  button.addEventListener('mousedown', (event) => event.preventDefault());

  if (icon) {
    const iconElement = document.createElement('i');
    iconElement.className = `bi bi-${icon}`;
    iconElement.setAttribute('aria-hidden', 'true');
    button.append(iconElement);
  }

  return button;
}

interface CreateColorDropdownOptions {
  label: string;
  symbol: string;
  markType: MarkType;
  commandFactory(color: string): Command;
  clearCommand: Command;
  colorDropdowns: ColorDropdown[];
  actions: ToolbarActions;
  closeColorDropdowns(): void;
  toggleColorDropdown(dropdown: ColorDropdown): void;
}

function createColorDropdown({
  label,
  symbol,
  markType,
  commandFactory,
  clearCommand,
  colorDropdowns,
  actions,
  closeColorDropdowns,
  toggleColorDropdown
}: CreateColorDropdownOptions): HTMLDivElement {
  const group = document.createElement('div');
  group.className = 'mg-editor-color-dropdown btn-group-sm';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', label);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'mg-editor-toolbar-button mg-editor-color-trigger btn btn-outline-secondary';
  button.dataset.command = markType.name;
  button.setAttribute('aria-label', label);
  button.setAttribute('aria-haspopup', 'menu');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-pressed', 'false');
  button.title = label;

  const symbolElement = document.createElement('span');
  symbolElement.className = 'mg-editor-color-symbol';
  symbolElement.textContent = symbol;
  symbolElement.setAttribute('aria-hidden', 'true');

  const preview = document.createElement('span');
  preview.className = 'mg-editor-color-preview';
  preview.setAttribute('aria-hidden', 'true');

  const caret = document.createElement('i');
  caret.className = 'bi bi-caret-down-fill mg-editor-color-caret';
  caret.setAttribute('aria-hidden', 'true');

  button.append(symbolElement, preview, caret);

  const menu = document.createElement('div');
  menu.className = 'mg-editor-color-menu dropdown-menu show p-2 shadow';
  menu.hidden = true;
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', `${label} palette`);

  const grid = document.createElement('div');
  grid.className = 'mg-editor-color-grid';
  grid.setAttribute('role', 'group');
  grid.setAttribute('aria-label', `${label} colors`);

  const commands = new Map<string, Command>();
  const colorButtons = new Map<string, HTMLButtonElement>();

  for (const color of colorPalette) {
    const command = commandFactory(color.value);
    commands.set(color.value, command);

    const colorButton = document.createElement('button');
    colorButton.type = 'button';
    colorButton.className = 'mg-editor-color-swatch btn';
    colorButton.dataset.command = `${markType.name}:${color.value}`;
    colorButton.style.setProperty('--mg-editor-swatch', color.value);
    colorButton.setAttribute('aria-label', `${label}: ${color.label}`);
    colorButton.setAttribute('aria-pressed', 'false');
    colorButton.title = color.label;
    colorButton.addEventListener('mousedown', (event) => event.preventDefault());
    colorButton.addEventListener('click', () => {
      actions.executeWithSavedSelection(command);
      closeColorDropdowns();
    });
    colorButtons.set(color.value, colorButton);
    grid.append(colorButton);
  }

  button.addEventListener('mousedown', (event) => event.preventDefault());
  button.addEventListener('pointerdown', () => actions.saveSelection());

  const clearButton = document.createElement('button');
  clearButton.type = 'button';
  clearButton.className = 'mg-editor-color-swatch mg-editor-color-clear btn';
  clearButton.dataset.command = `${markType.name}:clear`;
  clearButton.setAttribute('aria-label', `Clear ${label.toLowerCase()}`);
  clearButton.setAttribute('aria-pressed', 'false');
  clearButton.title = `Clear ${label.toLowerCase()}`;
  clearButton.addEventListener('mousedown', (event) => event.preventDefault());
  clearButton.addEventListener('click', () => {
    actions.executeWithSavedSelection(clearCommand);
    closeColorDropdowns();
  });

  const noColor = document.createElement('span');
  noColor.className = 'mg-editor-no-color';
  noColor.setAttribute('aria-hidden', 'true');
  clearButton.append(noColor);

  menu.append(grid, clearButton);

  const dropdown = { button, preview, menu, markType, commands, colorButtons, clearButton, clearCommand };
  button.addEventListener('click', () => toggleColorDropdown(dropdown));

  colorDropdowns.push(dropdown);
  group.append(button, menu);

  return group;
}
