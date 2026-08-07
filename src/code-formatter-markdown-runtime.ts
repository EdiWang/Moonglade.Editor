import * as markdownPlugin from 'prettier/plugins/markdown';
import type { FormatCodeRequest } from './code-editor-options';
import { formatWithPrettierPlugin } from './code-formatter-runtime-shared';

export async function formatWithPrettier(request: FormatCodeRequest): Promise<string> {
  return formatWithPrettierPlugin(request, 'markdown', markdownPlugin);
}
