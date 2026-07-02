import type { Command } from 'prosemirror-state';
import type { ToolbarButtonId, ToolbarContext } from './types';

export type CommandButtonItem = [ToolbarButtonId, string, string, Command];

export function createButtonGroup(ariaLabel?: string): HTMLDivElement {
  const group = document.createElement('div');
  group.className = 'btn-group btn-group-sm';
  group.setAttribute('role', 'group');

  if (ariaLabel) {
    group.setAttribute('aria-label', ariaLabel);
  }

  return group;
}

export function createCommandButtonGroup(
  context: ToolbarContext,
  items: CommandButtonItem[],
  ariaLabel?: string
): HTMLDivElement {
  const group = createButtonGroup(ariaLabel);

  for (const [name, icon, label, command] of items) {
    const button = createToolbarButton(name, icon, label);
    button.addEventListener('click', () => context.actions.execute(command));
    context.buttons[name] = button;
    group.append(button);
  }

  return group;
}

export function createToolbarButton(name: ToolbarButtonId, icon: string, ariaLabel: string): HTMLButtonElement {
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
