import type { FormatCodeRequest, FormatCodeResult } from './code-editor-options';
import { assertMoongladeCodeLanguage } from './code-languages';

type FormatterRuntime = typeof import('./code-formatter-runtime');
type FormatterRuntimeLoader = () => Promise<FormatterRuntime>;

const formatterAssetFileName = 'moonglade-editor.formatter.js';
const defaultFormatterAssetUrl = getDefaultFormatterAssetUrl();

let runtimeLoader: FormatterRuntimeLoader | undefined;
let runtimePromise: Promise<FormatterRuntime> | undefined;

export async function formatCode(request: FormatCodeRequest): Promise<FormatCodeResult> {
  assertFormatCodeRequest(request);

  const runtime = await loadFormatterRuntime();
  const value = await runtime.formatWithPrettier(request);

  return {
    value,
    changed: value !== request.value
  };
}

export function setFormatterRuntimeLoaderForTests(loader: FormatterRuntimeLoader | undefined): void {
  runtimeLoader = loader;
  runtimePromise = undefined;
}

async function loadFormatterRuntime(): Promise<FormatterRuntime> {
  runtimePromise ??= runtimeLoader ? runtimeLoader() : importFormatterRuntime(defaultFormatterAssetUrl);
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

function getDefaultFormatterAssetUrl(): string {
  const scriptUrl = getCurrentScriptUrl();

  if (scriptUrl) {
    return new URL(formatterAssetFileName, scriptUrl).href;
  }

  const moduleUrl = getImportMetaUrl();
  if (moduleUrl) {
    return new URL(formatterAssetFileName, moduleUrl).href;
  }

  return formatterAssetFileName;
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
