import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import type {
  MarkdownImageUploadOptions,
  MarkdownImageUploadResult,
  MoongladeCodeLanguage
} from './code-editor-options';
import { sanitizeImageUrl } from './safety';

interface UploadAndInsertOptions {
  insertPosition?: number;
  replaceSelection?: boolean;
}

interface MarkdownImageUploadStatusCallbacks {
  onUploadStart?: (files: readonly File[]) => void;
  onUploadError?: (error: unknown, file: File) => void;
  onUploadComplete?: (result: MarkdownImageUploadStatusResult) => void;
}

interface MarkdownImageUploadStatusResult {
  files: readonly File[];
  uploadedFiles: readonly File[];
  failedFiles: readonly File[];
  markdownImages: readonly string[];
}

const imageFileNamePattern = /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i;

export function createMarkdownImageUploadExtension(
  options: MarkdownImageUploadOptions | undefined,
  getLanguage: () => MoongladeCodeLanguage,
  callbacks: MarkdownImageUploadStatusCallbacks = {}
): Extension {
  if (!options) {
    return [];
  }

  return EditorView.domEventHandlers({
    paste: (event, view) => {
      const files = getImageFiles(event.clipboardData?.files);

      if (!shouldHandleImageFiles(files, view, getLanguage)) {
        return false;
      }

      event.preventDefault();
      void uploadAndInsertImages(view, options, files, { replaceSelection: true }, callbacks);
      return true;
    },
    drop: (event, view) => {
      const files = getImageFiles(event.dataTransfer?.files);

      if (!shouldHandleImageFiles(files, view, getLanguage)) {
        return false;
      }

      event.preventDefault();
      view.focus();
      void uploadAndInsertImages(view, options, files, {
        insertPosition: view.posAtCoords({
          x: event.clientX,
          y: event.clientY
        }) ?? undefined
      }, callbacks);
      return true;
    }
  });
}

export function assertOptionalMarkdownImageUploadOptions(value: unknown): asserts value is
  | MarkdownImageUploadOptions
  | undefined {
  if (value === undefined) {
    return;
  }

  if (!value || typeof value !== 'object') {
    throw new TypeError('Moonglade.Editor markdownImageUpload must be an object.');
  }

  const options = value as MarkdownImageUploadOptions;

  if (typeof options.upload !== 'function') {
    throw new TypeError('Moonglade.Editor markdownImageUpload.upload must be a function.');
  }

  if (options.getAltText !== undefined && typeof options.getAltText !== 'function') {
    throw new TypeError('Moonglade.Editor markdownImageUpload.getAltText must be a function.');
  }

  if (options.onError !== undefined && typeof options.onError !== 'function') {
    throw new TypeError('Moonglade.Editor markdownImageUpload.onError must be a function.');
  }
}

export function getImageFiles(files: FileList | File[] | undefined): File[] {
  if (!files) {
    return [];
  }

  return Array.from(files).filter(isImageFile);
}

export function createMarkdownImageText(
  uploaded: MarkdownImageUploadResult | string,
  file: File,
  options: MarkdownImageUploadOptions
): string {
  const result = normalizeUploadResult(uploaded);
  const alt = result.alt ?? options.getAltText?.(file) ?? getDefaultAltText(file);
  const title = result.title ? ` "${escapeMarkdownTitle(result.title)}"` : '';

  return `![${escapeMarkdownAltText(alt)}](${formatMarkdownUrl(result.url)}${title})`;
}

async function uploadAndInsertImages(
  view: EditorView,
  options: MarkdownImageUploadOptions,
  files: File[],
  insertOptions: UploadAndInsertOptions,
  callbacks: MarkdownImageUploadStatusCallbacks
): Promise<void> {
  const markdownImages: string[] = [];
  const uploadedFiles: File[] = [];
  const failedFiles: File[] = [];

  callbacks.onUploadStart?.(files);

  for (const file of files) {
    try {
      const uploaded = await options.upload(file);
      markdownImages.push(createMarkdownImageText(uploaded, file, options));
      uploadedFiles.push(file);
    } catch (error) {
      failedFiles.push(file);
      callbacks.onUploadError?.(error, file);
      reportUploadError(options, error, file);
    }
  }

  if (markdownImages.length > 0) {
    insertMarkdown(view, markdownImages.join('\n\n'), insertOptions);
  }

  callbacks.onUploadComplete?.({
    files,
    uploadedFiles,
    failedFiles,
    markdownImages
  });
}

function shouldHandleImageFiles(
  files: File[],
  view: EditorView,
  getLanguage: () => MoongladeCodeLanguage
): boolean {
  return files.length > 0 && getLanguage() === 'markdown' && !view.state.readOnly;
}

function insertMarkdown(view: EditorView, markdown: string, options: UploadAndInsertOptions): void {
  const selection = view.state.selection.main;
  const from = options.insertPosition ?? selection.from;
  const to = options.insertPosition ?? (options.replaceSelection ? selection.to : selection.from);

  view.dispatch({
    changes: {
      from,
      to,
      insert: markdown
    },
    selection: {
      anchor: from + markdown.length
    },
    scrollIntoView: true
  });
}

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || imageFileNamePattern.test(file.name);
}

function normalizeUploadResult(uploaded: MarkdownImageUploadResult | string): MarkdownImageUploadResult {
  if (typeof uploaded === 'string') {
    return assertUploadUrl({ url: uploaded });
  }

  if (!uploaded || typeof uploaded !== 'object') {
    throw new TypeError('Moonglade.Editor markdown image upload result must be a URL string or object.');
  }

  return assertUploadUrl(uploaded);
}

function assertUploadUrl(result: MarkdownImageUploadResult): MarkdownImageUploadResult {
  if (typeof result.url !== 'string' || result.url.length === 0) {
    throw new TypeError('Moonglade.Editor markdown image upload result url must be a non-empty string.');
  }

  const url = sanitizeImageUrl(result.url);
  if (!url) {
    throw new TypeError('Moonglade.Editor markdown image upload result url must be a safe image URL.');
  }

  return {
    ...result,
    url
  };
}

function getDefaultAltText(file: File): string {
  return file.name
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();
}

function escapeMarkdownAltText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/]/g, '\\]');
}

function escapeMarkdownTitle(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function formatMarkdownUrl(value: string): string {
  if (/[\s()<>]/.test(value)) {
    return `<${value.replace(/>/g, '%3E')}>`;
  }

  return value;
}

function reportUploadError(options: MarkdownImageUploadOptions, error: unknown, file: File): void {
  if (options.onError) {
    options.onError(error, file);
    return;
  }

  console.error('Moonglade.Editor markdown image upload failed.', error);
}
