import * as prettier from 'prettier/standalone';
import * as htmlPlugin from 'prettier/plugins/html';
import * as markdownPlugin from 'prettier/plugins/markdown';
import * as postcssPlugin from 'prettier/plugins/postcss';
import type { Plugin } from 'prettier';
import type { FormatCodeRequest, MoongladeCodeLanguage } from './code-editor-options';

const parsers: Record<MoongladeCodeLanguage, string> = {
  markdown: 'markdown',
  html: 'html',
  css: 'css'
};

const plugins: Record<MoongladeCodeLanguage, Plugin[]> = {
  markdown: [markdownPlugin],
  html: [htmlPlugin],
  css: [postcssPlugin]
};

export async function formatWithPrettier(request: FormatCodeRequest): Promise<string> {
  return prettier.format(request.value, {
    parser: parsers[request.language],
    plugins: plugins[request.language],
    tabWidth: request.tabSize,
    useTabs: false
  });
}
