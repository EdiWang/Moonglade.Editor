import type { FormatCodeRequest, FormatCodeResult, MoongladeCodeLanguage } from './code-editor-options';
import { assertMoongladeCodeLanguage } from './code-languages';

interface FormatterRuntime {
  formatWithPrettier(request: FormatCodeRequest): Promise<string>;
}

type FormatterRuntimeLoader = (language: MoongladeCodeLanguage) => Promise<FormatterRuntime>;

const formatterAssetFileNames: Record<MoongladeCodeLanguage, string> = {
  markdown: 'moonglade-editor.formatter.markdown.js',
  html: 'moonglade-editor.formatter.html.js',
  css: 'moonglade-editor.formatter.css.js'
};
const defaultFormatterAssetUrls = getDefaultFormatterAssetUrls();

let runtimeLoader: FormatterRuntimeLoader | undefined;
let runtimePromises: Partial<Record<MoongladeCodeLanguage, Promise<FormatterRuntime>>> = {};

export async function formatCode(request: FormatCodeRequest): Promise<FormatCodeResult> {
  assertFormatCodeRequest(request);

  const runtime = await loadFormatterRuntime(request.language);
  const value = await runtime.formatWithPrettier(request);

  return {
    value,
    changed: value !== request.value
  };
}

export function setFormatterRuntimeLoaderForTests(loader: FormatterRuntimeLoader | undefined): void {
  runtimeLoader = loader;
  runtimePromises = {};
}

async function loadFormatterRuntime(language: MoongladeCodeLanguage): Promise<FormatterRuntime> {
  const runtimePromise = runtimePromises[language] ?? (runtimeLoader
    ? runtimeLoader(language)
    : importFormatterRuntime(defaultFormatterAssetUrls[language]));
  runtimePromises[language] = runtimePromise;
  return runtimePromise;
}

async function importFormatterRuntime(specifier: string): Promise<FormatterRuntime> {
  return import(specifier) as Promise<FormatterRuntime>;
}

function assertFormatCodeRequest(request: FormatCodeRequest): void {
  if (!request || typeof request !== 'object') {
    throw new TypeError('Moonglade.Editor code format request must be an object.');
  }

  assertMoongladeCodeLanguage(request.language);

  if (typeof request.value !== 'string') {
    throw new TypeError('Moonglade.Editor code format value must be a string.');
  }

  if (typeof request.tabSize !== 'number' || !Number.isInteger(request.tabSize) || request.tabSize < 1) {
    throw new TypeError('Moonglade.Editor code format tabSize must be a positive integer.');
  }
}

function getDefaultFormatterAssetUrls(): Record<MoongladeCodeLanguage, string> {
  const baseUrl = getCurrentScriptUrl() ?? getImportMetaUrl();

  if (!baseUrl) {
    return formatterAssetFileNames;
  }

  return {
    markdown: resolveFormatterAssetUrl(baseUrl, formatterAssetFileNames.markdown),
    html: resolveFormatterAssetUrl(baseUrl, formatterAssetFileNames.html),
    css: resolveFormatterAssetUrl(baseUrl, formatterAssetFileNames.css)
  };
}

function resolveFormatterAssetUrl(baseUrl: string, formatterAssetFileName: string): string {
  const url = new URL(baseUrl);
  const assetPath = url.pathname.includes('/chunks/')
    ? `../${formatterAssetFileName}`
    : formatterAssetFileName;

  return new URL(assetPath, url).href;
}

function getImportMetaUrl(): string | undefined {
  try {
    return import.meta.url;
  } catch {
    return undefined;
  }
}

function getCurrentScriptUrl(): string | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }

  const currentScript = document.currentScript;

  if (currentScript instanceof HTMLScriptElement && currentScript.src) {
    return currentScript.src;
  }

  const scripts = Array.from(document.scripts);
  const editorScript = scripts
    .reverse()
    .find((script) => /moonglade-editor(?:\.global)?\.js(?:\?|#|$)/.test(script.src));

  return editorScript?.src;
}
