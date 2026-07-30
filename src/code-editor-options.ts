export type MoongladeCodeLanguage = 'markdown' | 'html' | 'css';

export interface MoongladeCodeEditorOptions {
  element: HTMLElement;
  textarea?: HTMLTextAreaElement;
  content?: string;
  language: MoongladeCodeLanguage;
  height?: string;
  lineWrapping?: boolean;
  tabSize?: number;
  readOnly?: boolean;
  markdownImageUpload?: MarkdownImageUploadOptions;
  onChange?: (value: string) => void;
}

export interface MarkdownImageUploadOptions {
  upload: (file: File) => Promise<MarkdownImageUploadResult | string>;
  getAltText?: (file: File) => string;
  onError?: (error: unknown, file: File) => void;
}

export interface MarkdownImageUploadResult {
  url: string;
  alt?: string;
  title?: string;
}

export interface FormatCodeRequest {
  language: MoongladeCodeLanguage;
  value: string;
  tabSize: number;
}

export interface FormatCodeResult {
  value: string;
  changed: boolean;
}
