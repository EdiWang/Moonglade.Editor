import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { markdown } from '@codemirror/lang-markdown';
import type { Extension } from '@codemirror/state';
import type { MoongladeCodeLanguage } from './code-editor-options';

const SUPPORTED_LANGUAGES = new Set<MoongladeCodeLanguage>(['markdown', 'html', 'css']);

export function isMoongladeCodeLanguage(value: unknown): value is MoongladeCodeLanguage {
  return typeof value === 'string' && SUPPORTED_LANGUAGES.has(value as MoongladeCodeLanguage);
}

export function assertMoongladeCodeLanguage(value: unknown): asserts value is MoongladeCodeLanguage {
  if (!isMoongladeCodeLanguage(value)) {
    throw new TypeError('Moonglade.Editor code mode must be one of: markdown, html, css.');
  }
}

export function createLanguageExtension(language: MoongladeCodeLanguage): Extension {
  assertMoongladeCodeLanguage(language);

  switch (language) {
    case 'markdown':
      return markdown();
    case 'html':
      return html();
    case 'css':
      return css();
  }
}
