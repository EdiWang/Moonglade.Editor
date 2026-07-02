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
import { blockFormats, colorPalette, type CodeSampleLanguageOption } from './editor-options';
import { hasAllowedImageUploadExtension } from './image-upload';

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
  | 'horizontalRule'
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
  tableDropdown: TableDropdown;
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

export interface TableDropdown {
  root: HTMLDivElement;
  button: HTMLButtonElement;
  menu: HTMLDivElement;
  panels: Record<TableMenuPanel, HTMLDivElement>;
  panelButtons: Record<TableMenuPanel, HTMLButtonElement>;
  gridButtons: Map<string, HTMLButtonElement>;
  sizeLabel: HTMLSpanElement;
}

type TableMenuPanel = 'insert' | 'row' | 'column';

const TABLE_GRID_ROWS = 6;
const TABLE_GRID_COLUMNS = 8;
const tableMenuPanels: TableMenuPanel[] = ['insert', 'row', 'column'];

interface CreateToolbarOptions {
  schema: Schema;
  commands: MoongladeEditorCommands;
  uploadConfigured: boolean;
  allowedImageExtensions: readonly string[];
  codeSampleLanguages: readonly CodeSampleLanguageOption[];
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

export function createToolbar({
  schema,
  commands,
  uploadConfigured,
  allowedImageExtensions,
  codeSampleLanguages,
  actions
}: CreateToolbarOptions): ToolbarElements {
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
  let tableDropdown: TableDropdown | undefined;
  const localCloseTableDropdown = (): void => {
    if (tableDropdown) {
      closeTableDropdown({ tableDropdown });
    }
  };
  const localCloseColorDropdowns = (except?: ColorDropdown): void => {
    closeColorDropdowns({ colorDropdowns }, except);
  };
  const localToggleColorDropdown = (dropdown: ColorDropdown): void => {
    const shouldOpen = dropdown.menu.hidden;
    localCloseColorDropdowns(dropdown);
    localCloseTableDropdown();
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
  imageInput.accept = allowedImageExtensions.join(',');
  imageInput.hidden = true;
  imageButton.disabled = !uploadConfigured;
  imageButton.addEventListener('click', () => {
    actions.saveSelection();
    imageInput.click();
  });
  imageInput.addEventListener('change', () => {
    const file = getFirstImageFile(imageInput.files, allowedImageExtensions);
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

  const horizontalRuleButton = createToolbarButton('horizontalRule', 'hr', 'Insert horizontal rule');
  horizontalRuleButton.addEventListener('click', () => actions.execute(commands.insertHorizontalRule));
  buttons.horizontalRule = horizontalRuleButton;

  insertGroup.append(imageButton, imageInput, linkButton, codeButton, horizontalRuleButton);
  root.append(insertGroup);

  tableDropdown = createTableDropdown({
    commands,
    buttons,
    actions,
    closeColorDropdowns: localCloseColorDropdowns
  });
  root.append(tableDropdown.root);

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
  const codeDialog = createCodeDialog(commands, actions, codeSampleLanguages);
  const sourceDialog = createSourceDialog(actions);
  root.append(linkDialog.root, codeDialog.root, sourceDialog.root);

  return { root, formatSelect, buttons, colorDropdowns, tableDropdown, imageInput, uploadStatus, linkDialog, codeDialog, sourceDialog };
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

export function closeTableDropdown(toolbar: Pick<ToolbarElements, 'tableDropdown'>): void {
  toolbar.tableDropdown.menu.hidden = true;
  toolbar.tableDropdown.button.setAttribute('aria-expanded', 'false');
}

export function getFirstImageFile(files: FileList | File[] | null | undefined, allowedImageExtensions: readonly string[]): File | null {
  return Array.from(files ?? []).find((file) => file.type.startsWith('image/') || hasAllowedImageUploadExtension(file, allowedImageExtensions)) ?? null;
}

interface CreateTableDropdownOptions {
  commands: MoongladeEditorCommands;
  buttons: ToolbarButtons;
  actions: ToolbarActions;
  closeColorDropdowns(): void;
}

function createTableDropdown({ commands, buttons, actions, closeColorDropdowns }: CreateTableDropdownOptions): TableDropdown {
  const root = document.createElement('div');
  root.className = 'mg-editor-table-dropdown btn-group btn-group-sm';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Table tools');

  const button = createToolbarButton('insertTable', 'table', 'Table');
  button.classList.add('mg-editor-table-trigger');
  button.setAttribute('aria-haspopup', 'menu');
  button.setAttribute('aria-expanded', 'false');
  const caret = document.createElement('i');
  caret.className = 'bi bi-chevron-down mg-editor-table-trigger-caret';
  caret.setAttribute('aria-hidden', 'true');
  button.append(caret);
  buttons.insertTable = button;

  const menu = document.createElement('div');
  menu.className = 'mg-editor-table-menu dropdown-menu show shadow';
  menu.hidden = true;
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', 'Table tools');

  const menuList = document.createElement('div');
  menuList.className = 'mg-editor-table-menu-list';

  const panels = {} as Record<TableMenuPanel, HTMLDivElement>;
  const panelButtons = {} as Record<TableMenuPanel, HTMLButtonElement>;
  const gridButtons = new Map<string, HTMLButtonElement>();
  const sizeLabel = document.createElement('span');
  sizeLabel.className = 'mg-editor-table-size-label';
  const dropdown: TableDropdown = { root, button, menu, panels, panelButtons, gridButtons, sizeLabel };

  const setPanel = (panel: TableMenuPanel): void => {
    for (const panelName of tableMenuPanels) {
      const active = panelName === panel;
      panels[panelName].hidden = !active;
      panelButtons[panelName].classList.toggle('active', active);
      panelButtons[panelName].setAttribute('aria-expanded', active ? 'true' : 'false');
    }
  };

  const closeMenu = (): void => closeTableDropdown({ tableDropdown: dropdown });

  panelButtons.insert = createTablePanelButton('Table', 'table', 'insert');
  panelButtons.row = createTablePanelButton('Row', 'layout-three-columns', 'row');
  panelButtons.column = createTablePanelButton('Column', 'layout-sidebar', 'column');

  for (const panelName of tableMenuPanels) {
    const panelButton = panelButtons[panelName];
    panelButton.addEventListener('pointerenter', () => setPanel(panelName));
    panelButton.addEventListener('click', () => setPanel(panelName));
    menuList.append(panelButton);
  }

  menuList.append(createTableMenuSeparator());

  const headerButton = createTableMenuCommandButton('toggleTableHeaderRow', 'layout-three-columns', 'Toggle header row');
  headerButton.addEventListener('click', () => {
    actions.execute(commands.toggleTableHeaderRow);
    closeMenu();
  });
  buttons.toggleTableHeaderRow = headerButton;

  const deleteTableButton = createTableMenuCommandButton('deleteTable', 'x-square', 'Delete table', 'text-danger');
  deleteTableButton.addEventListener('click', () => {
    actions.execute(commands.deleteTable);
    closeMenu();
  });
  buttons.deleteTable = deleteTableButton;

  menuList.append(headerButton, deleteTableButton);

  panels.insert = createInsertTablePanel(
    commands,
    actions,
    closeMenu,
    gridButtons,
    sizeLabel,
    (columns, rows) => updateTableGridPreview(dropdown, columns, rows)
  );
  panels.row = createCommandPanel(
    'row',
    'Row tools',
    [
      ['addTableRow', 'plus-lg', 'Add row', commands.addTableRow],
      ['deleteTableRow', 'dash-lg', 'Delete row', commands.deleteTableRow]
    ],
    buttons,
    actions,
    closeMenu
  );
  panels.column = createCommandPanel(
    'column',
    'Column tools',
    [
      ['addTableColumn', 'plus-square', 'Add column', commands.addTableColumn],
      ['deleteTableColumn', 'dash-square', 'Delete column', commands.deleteTableColumn]
    ],
    buttons,
    actions,
    closeMenu
  );

  const panelShell = document.createElement('div');
  panelShell.className = 'mg-editor-table-panel-shell';
  panelShell.append(panels.insert, panels.row, panels.column);

  menu.append(menuList, panelShell);
  root.append(button, menu);

  button.addEventListener('click', () => {
    const shouldOpen = menu.hidden;
    closeColorDropdowns();
    menu.hidden = !shouldOpen;
    button.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    if (shouldOpen) {
      setPanel('insert');
      updateTableGridPreview(dropdown, 3, 3);
    }
  });
  button.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMenu();
      button.focus();
    }
  });
  menu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMenu();
      button.focus();
    }
  });

  setPanel('insert');
  updateTableGridPreview(dropdown, 3, 3);

  return dropdown;
}

function createTablePanelButton(label: string, icon: string, panel: TableMenuPanel): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'mg-editor-table-menu-item';
  button.dataset.tablePanel = panel;
  button.setAttribute('role', 'menuitem');
  button.setAttribute('aria-haspopup', 'true');
  button.setAttribute('aria-expanded', 'false');
  button.addEventListener('mousedown', (event) => event.preventDefault());

  const iconElement = document.createElement('i');
  iconElement.className = `bi bi-${icon}`;
  iconElement.setAttribute('aria-hidden', 'true');

  const labelElement = document.createElement('span');
  labelElement.textContent = label;

  const chevron = document.createElement('i');
  chevron.className = 'bi bi-chevron-right mg-editor-table-menu-chevron';
  chevron.setAttribute('aria-hidden', 'true');

  button.append(iconElement, labelElement, chevron);
  return button;
}

function createTableMenuCommandButton(name: ToolbarButtonId, icon: string, label: string, extraClass = ''): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `mg-editor-table-menu-item ${extraClass}`.trim();
  button.dataset.command = name;
  button.setAttribute('role', 'menuitem');
  button.setAttribute('aria-label', label);
  button.setAttribute('aria-pressed', 'false');
  button.title = label;
  button.addEventListener('mousedown', (event) => event.preventDefault());

  const iconElement = document.createElement('i');
  iconElement.className = `bi bi-${icon}`;
  iconElement.setAttribute('aria-hidden', 'true');

  const labelElement = document.createElement('span');
  labelElement.textContent = label;

  button.append(iconElement, labelElement);
  return button;
}

function createTableMenuSeparator(): HTMLDivElement {
  const separator = document.createElement('div');
  separator.className = 'mg-editor-table-menu-separator';
  separator.setAttribute('role', 'separator');
  return separator;
}

function createInsertTablePanel(
  commands: MoongladeEditorCommands,
  actions: ToolbarActions,
  closeMenu: () => void,
  gridButtons: Map<string, HTMLButtonElement>,
  sizeLabel: HTMLSpanElement,
  updatePreview: (columns: number, rows: number) => void
): HTMLDivElement {
  const panel = document.createElement('div');
  panel.className = 'mg-editor-table-panel';
  panel.dataset.panel = 'insert';
  panel.setAttribute('role', 'group');
  panel.setAttribute('aria-label', 'Insert table size');

  const grid = document.createElement('div');
  grid.className = 'mg-editor-table-grid';

  for (let row = 1; row <= TABLE_GRID_ROWS; row += 1) {
    for (let column = 1; column <= TABLE_GRID_COLUMNS; column += 1) {
      const gridButton = document.createElement('button');
      const commandId = `insertTable:${column}x${row}`;
      gridButton.type = 'button';
      gridButton.className = 'mg-editor-table-grid-cell';
      gridButton.dataset.command = commandId;
      gridButton.dataset.tableColumns = String(column);
      gridButton.dataset.tableRows = String(row);
      gridButton.setAttribute('aria-label', `Insert ${column} by ${row} table`);
      gridButton.addEventListener('mousedown', (event) => event.preventDefault());
      gridButton.addEventListener('pointerenter', () => updatePreview(column, row));
      gridButton.addEventListener('mouseover', () => updatePreview(column, row));
      gridButton.addEventListener('focus', () => updatePreview(column, row));
      gridButton.addEventListener('click', () => {
        actions.execute(commands.insertTable(row, column));
        closeMenu();
      });
      gridButtons.set(commandId, gridButton);
      grid.append(gridButton);
    }
  }

  panel.append(grid, sizeLabel);
  return panel;
}

function createCommandPanel(
  panelName: TableMenuPanel,
  label: string,
  items: Array<[ToolbarButtonId, string, string, Command]>,
  buttons: ToolbarButtons,
  actions: ToolbarActions,
  closeMenu: () => void
): HTMLDivElement {
  const panel = document.createElement('div');
  panel.className = 'mg-editor-table-panel';
  panel.dataset.panel = panelName;
  panel.hidden = true;
  panel.setAttribute('role', 'group');
  panel.setAttribute('aria-label', label);

  for (const [name, icon, itemLabel, command] of items) {
    const button = createTableMenuCommandButton(name, icon, itemLabel);
    button.addEventListener('click', () => {
      actions.execute(command);
      closeMenu();
    });
    buttons[name] = button;
    panel.append(button);
  }

  return panel;
}

function updateTableGridPreview(dropdown: Pick<TableDropdown, 'gridButtons' | 'sizeLabel'>, columns: number, rows: number): void {
  dropdown.sizeLabel.textContent = `${columns}x${rows}`;

  for (const cell of dropdown.gridButtons.values()) {
    const cellColumns = Number(cell.dataset.tableColumns);
    const cellRows = Number(cell.dataset.tableRows);
    cell.classList.toggle('active', cellColumns <= columns && cellRows <= rows);
  }
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
