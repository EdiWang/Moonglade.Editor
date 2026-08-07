import * as postcssPlugin from 'prettier/plugins/postcss';
import type { FormatCodeRequest } from './code-editor-options';
import { formatWithPrettierPlugin } from './code-formatter-runtime-shared';

export async function formatWithPrettier(request: FormatCodeRequest): Promise<string> {
  return formatWithPrettierPlugin(request, 'css', postcssPlugin);
}
