import type { Command } from 'prosemirror-state';
import { createToolbarButton } from './dom';
import type { TableDropdown, TableMenuPanel, ToolbarButtonId, ToolbarContext, ToolbarElements } from './types';

const TABLE_GRID_ROWS = 6;
const TABLE_GRID_COLUMNS = 8;
const TABLE_MENU_VIEWPORT_MARGIN = 8;
const TABLE_MENU_WIDE_WIDTH_REM = 26;
const tableMenuPanels: TableMenuPanel[] = ['insert', 'row', 'column'];

export function createTableTools(context: ToolbarContext): TableDropdown {
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
  context.buttons.insertTable = button;

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
    context.actions.execute(context.commands.toggleTableHeaderRow);
    closeMenu();
  });
  context.buttons.toggleTableHeaderRow = headerButton;

  const deleteTableButton = createTableMenuCommandButton('deleteTable', 'x-square', 'Delete table', 'text-danger');
  deleteTableButton.addEventListener('click', () => {
    context.actions.execute(context.commands.deleteTable);
    closeMenu();
  });
  context.buttons.deleteTable = deleteTableButton;

  menuList.append(headerButton, deleteTableButton);

  panels.insert = createInsertTablePanel(
    context,
    closeMenu,
    gridButtons,
    sizeLabel,
    (columns, rows) => updateTableGridPreview(dropdown, columns, rows)
  );
  panels.row = createCommandPanel(
    'row',
    'Row tools',
    [
      ['addTableRow', 'plus-lg', 'Add row', context.commands.addTableRow],
      ['deleteTableRow', 'dash-lg', 'Delete row', context.commands.deleteTableRow]
    ],
    context,
    closeMenu
  );
  panels.column = createCommandPanel(
    'column',
    'Column tools',
    [
      ['addTableColumn', 'plus-square', 'Add column', context.commands.addTableColumn],
      ['deleteTableColumn', 'dash-square', 'Delete column', context.commands.deleteTableColumn]
    ],
    context,
    closeMenu
  );

  const panelShell = document.createElement('div');
  panelShell.className = 'mg-editor-table-panel-shell';
  panelShell.append(panels.insert, panels.row, panels.column);

  menu.append(menuList, panelShell);
  root.append(button, menu);

  button.addEventListener('click', () => {
    const shouldOpen = menu.hidden;
    context.closeColorDropdowns();
    menu.hidden = !shouldOpen;
    button.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    if (shouldOpen) {
      setPanel('insert');
      updateTableGridPreview(dropdown, 3, 3);
      positionTableDropdown(dropdown);
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

export function closeTableDropdown(toolbar: Pick<ToolbarElements, 'tableDropdown'>): void {
  toolbar.tableDropdown.menu.hidden = true;
  toolbar.tableDropdown.button.setAttribute('aria-expanded', 'false');
}

function positionTableDropdown(dropdown: Pick<TableDropdown, 'root' | 'menu'>): void {
  const { root, menu } = dropdown;
  menu.style.left = '0px';
  menu.style.right = 'auto';
  menu.classList.remove('mg-editor-table-menu-compact');

  const viewportWidth = getViewportWidth();
  const viewportLeft = TABLE_MENU_VIEWPORT_MARGIN;
  const viewportRight = Math.max(viewportLeft, viewportWidth - TABLE_MENU_VIEWPORT_MARGIN);
  const boundary = root.closest<HTMLElement>('.mg-editor') ?? root.parentElement;
  const boundaryRect = boundary?.getBoundingClientRect();
  const boundaryLeft = Math.max(boundaryRect?.left ?? viewportLeft, viewportLeft);
  const boundaryRight = Math.min(boundaryRect?.right ?? viewportRight, viewportRight);
  const availableWidth = boundaryRight - boundaryLeft;

  if (availableWidth <= 0) {
    menu.style.removeProperty('max-width');
    return;
  }

  menu.style.maxWidth = `${Math.round(availableWidth)}px`;
  menu.classList.toggle('mg-editor-table-menu-compact', availableWidth < getWideMenuWidth());

  const rootRect = root.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  const minLeft = boundaryLeft - rootRect.left;
  const maxLeft = boundaryRight - rootRect.left - menuRect.width;

  if (!Number.isFinite(minLeft) || !Number.isFinite(maxLeft)) {
    return;
  }

  menu.style.left = `${Math.round(clamp(0, minLeft, maxLeft))}px`;
}

function getViewportWidth(): number {
  return window.innerWidth || document.documentElement.clientWidth || 0;
}

function getWideMenuWidth(): number {
  const rootFontSize = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize);
  return (Number.isFinite(rootFontSize) ? rootFontSize : 16) * TABLE_MENU_WIDE_WIDTH_REM;
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
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
  context: ToolbarContext,
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
        context.actions.execute(context.commands.insertTable(row, column));
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
  context: ToolbarContext,
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
      context.actions.execute(command);
      closeMenu();
    });
    context.buttons[name] = button;
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
