import * as prettier from 'prettier/standalone';
import type { Plugin } from 'prettier';
import type { FormatCodeRequest } from './code-editor-options';

export async function formatWithPrettierPlugin(
  request: FormatCodeRequest,
  parser: string,
  plugin: Plugin
): Promise<string> {
  return prettier.format(request.value, {
    parser,
    plugins: [plugin],
    tabWidth: request.tabSize,
    useTabs: false
  });
}
