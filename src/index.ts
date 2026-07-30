import {
  createMoongladeEditor as createRichHtmlEditor,
  MoongladeEditor as MoongladeRichHtmlEditor,
  type MoongladeEditorOptions as MoongladeRichHtmlEditorOptions
} from './editor';
import {
  createMoongladeCodeEditor,
  MoongladeCodeEditor
} from './code-editor';
import type { MoongladeCodeEditorOptions, MoongladeCodeLanguage } from './code-editor-options';

export {
  MoongladeRichHtmlEditor,
  MoongladeRichHtmlEditor as MoongladeEditor,
  MoongladeCodeEditor,
  createMoongladeCodeEditor
};
export { createCommands } from './commands';
export type { MoongladeEditorCommands } from './commands';
export { parseHtml, roundTripHtml, serializeHtml } from './html';
export type { MoongladeImageUploader, MoongladeImageUploadResult } from './image-upload';
export type { CodeSampleLanguageOption } from './editor-options';
export type {
  FormatCodeRequest,
  FormatCodeResult,
  MarkdownImageUploadOptions,
  MarkdownImageUploadResult,
  MoongladeCodeLanguage,
  MoongladeCodeEditorOptions
} from './code-editor-options';
export { formatCode } from './code-formatter';
export { createLanguageExtension } from './code-languages';
export { moongladeSchema } from './schema';

export type MoongladeEditorMode = 'rich-html' | MoongladeCodeLanguage;

export type MoongladeUnifiedEditorOptions =
  | (MoongladeRichHtmlEditorOptions & { mode?: 'rich-html' })
  | (Omit<MoongladeCodeEditorOptions, 'language'> & { mode: MoongladeCodeLanguage });

export type MoongladeUnifiedEditor = MoongladeRichHtmlEditor | MoongladeCodeEditor;
export type MoongladeEditorOptions = MoongladeUnifiedEditorOptions;

export function createMoongladeEditor(options: MoongladeUnifiedEditorOptions): MoongladeUnifiedEditor {
  if (isCodeEditorMode(options.mode)) {
    const { mode, ...codeOptions } = options;
    return createMoongladeCodeEditor({
      ...codeOptions,
      language: mode
    });
  }

  const { mode: _mode, ...richHtmlOptions } = options;
  return createRichHtmlEditor(richHtmlOptions);
}

function isCodeEditorMode(mode: MoongladeEditorMode | undefined): mode is MoongladeCodeLanguage {
  return mode === 'markdown' || mode === 'html' || mode === 'css';
}
