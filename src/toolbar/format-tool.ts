import { blockFormats } from '../editor-options';
import type { ToolbarContext } from './types';

export interface FormatToolElements {
  group: HTMLDivElement;
  formatSelect: HTMLSelectElement;
}

export function createFormatTool(context: ToolbarContext): FormatToolElements {
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
    context.actions.execute(type === 'heading'
      ? context.commands.heading(Number(level))
      : context.commands.paragraph);
  });

  const group = document.createElement('div');
  group.className = 'mg-editor-format-group input-group input-group-sm';
  group.append(formatSelect);

  return { group, formatSelect };
}
