import { sanitizeCodeLanguage } from './safety';

export interface CodeSampleLanguageOption {
  text: string;
  value: string;
}

export const blockFormats = [
  { value: 'paragraph', label: 'Paragraph' },
  { value: 'heading:1', label: 'Heading 1' },
  { value: 'heading:2', label: 'Heading 2' },
  { value: 'heading:3', label: 'Heading 3' },
  { value: 'heading:4', label: 'Heading 4' },
  { value: 'heading:5', label: 'Heading 5' },
  { value: 'heading:6', label: 'Heading 6' }
] as const;

export const colorPalette = [
  { label: 'Black', value: '#000000' },
  { label: 'Dark', value: '#212529' },
  { label: 'Gray', value: '#6c757d' },
  { label: 'Light gray', value: '#ced4da' },
  { label: 'White', value: '#ffffff' },
  { label: 'Blue', value: '#0d6efd' },
  { label: 'Green', value: '#198754' },
  { label: 'Teal', value: '#20c997' },
  { label: 'Cyan', value: '#0dcaf0' },
  { label: 'Indigo', value: '#6610f2' },
  { label: 'Purple', value: '#6f42c1' },
  { label: 'Red', value: '#dc3545' },
  { label: 'Pink', value: '#d63384' },
  { label: 'Orange', value: '#fd7e14' },
  { label: 'Yellow', value: '#ffc107' }
] as const;

export const defaultCodeSampleLanguages: readonly CodeSampleLanguageOption[] = [
  { text: 'Plain text', value: '' },
  { text: 'C#', value: 'csharp' },
  { text: 'JavaScript', value: 'javascript' },
  { text: 'TypeScript', value: 'typescript' },
  { text: 'HTML', value: 'html' },
  { text: 'CSS', value: 'css' },
  { text: 'PowerShell', value: 'powershell' },
  { text: 'SQL', value: 'sql' },
  { text: 'JSON', value: 'json' },
  { text: 'XML', value: 'xml' }
] as const;

export function normalizeCodeSampleLanguages(
  languages: readonly CodeSampleLanguageOption[] | undefined
): readonly CodeSampleLanguageOption[] {
  const source = languages ?? defaultCodeSampleLanguages;

  return source.reduce<CodeSampleLanguageOption[]>((normalizedLanguages, language) => {
    const option = language as Partial<CodeSampleLanguageOption> | null | undefined;
    const text = typeof option?.text === 'string' ? option.text.trim() : '';
    const rawValue = option?.value;
    const value = rawValue === ''
      ? ''
      : typeof rawValue === 'string'
        ? sanitizeCodeLanguage(rawValue)
        : false;

    if (text && value !== false) {
      normalizedLanguages.push({ text, value });
    }

    return normalizedLanguages;
  }, []);
}
