import type { MarkType } from 'prosemirror-model';
import type { Command } from 'prosemirror-state';
import { colorPalette } from '../editor-options';
import { preserveDisabledButtonTitle } from './dom';
import type { ColorDropdown, ToolbarContext, ToolbarElements } from './types';

export function createColorTools(context: ToolbarContext): HTMLDivElement {
  const colorGroup = document.createElement('div');
  colorGroup.className = 'mg-editor-color-group btn-group btn-group-sm';
  colorGroup.setAttribute('role', 'group');
  colorGroup.setAttribute('aria-label', 'Text colors');

  colorGroup.append(
    createColorDropdown({
      label: 'Text color',
      symbol: 'A',
      markType: context.schema.marks.text_color,
      commandFactory: (color) => context.commands.textColor(color),
      clearCommand: context.commands.clearTextColor,
      context
    }),
    createColorDropdown({
      label: 'Background color',
      symbol: 'ab',
      markType: context.schema.marks.background_color,
      commandFactory: (color) => context.commands.backgroundColor(color),
      clearCommand: context.commands.clearBackgroundColor,
      context
    })
  );

  return colorGroup;
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

interface CreateColorDropdownOptions {
  label: string;
  symbol: string;
  markType: MarkType;
  commandFactory(color: string): Command;
  clearCommand: Command;
  context: ToolbarContext;
}

function createColorDropdown({
  label,
  symbol,
  markType,
  commandFactory,
  clearCommand,
  context
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
  preserveDisabledButtonTitle(button);

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
    preserveDisabledButtonTitle(colorButton);
    colorButton.addEventListener('mousedown', (event) => event.preventDefault());
    colorButton.addEventListener('click', () => {
      context.actions.executeWithSavedSelection(command);
      context.closeColorDropdowns();
    });
    colorButtons.set(color.value, colorButton);
    grid.append(colorButton);
  }

  button.addEventListener('mousedown', (event) => event.preventDefault());
  button.addEventListener('pointerdown', () => context.actions.saveSelection());

  const clearButton = document.createElement('button');
  clearButton.type = 'button';
  clearButton.className = 'mg-editor-color-swatch mg-editor-color-clear btn';
  clearButton.dataset.command = `${markType.name}:clear`;
  clearButton.setAttribute('aria-label', `Clear ${label.toLowerCase()}`);
  clearButton.setAttribute('aria-pressed', 'false');
  clearButton.title = `Clear ${label.toLowerCase()}`;
  preserveDisabledButtonTitle(clearButton);
  clearButton.addEventListener('mousedown', (event) => event.preventDefault());
  clearButton.addEventListener('click', () => {
    context.actions.executeWithSavedSelection(clearCommand);
    context.closeColorDropdowns();
  });

  const noColor = document.createElement('span');
  noColor.className = 'mg-editor-no-color';
  noColor.setAttribute('aria-hidden', 'true');
  clearButton.append(noColor);

  menu.append(grid, clearButton);

  const dropdown = { button, preview, menu, markType, commands, colorButtons, clearButton, clearCommand };
  button.addEventListener('click', () => context.toggleColorDropdown(dropdown));

  context.colorDropdowns.push(dropdown);
  group.append(button, menu);

  return group;
}
