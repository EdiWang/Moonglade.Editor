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

export const codeLanguages = [
  { label: 'Plain text', value: '' },
  { label: 'C#', value: 'csharp' },
  { label: 'JavaScript', value: 'javascript' },
  { label: 'TypeScript', value: 'typescript' },
  { label: 'HTML', value: 'html' },
  { label: 'CSS', value: 'css' },
  { label: 'PowerShell', value: 'powershell' },
  { label: 'SQL', value: 'sql' },
  { label: 'JSON', value: 'json' },
  { label: 'XML', value: 'xml' }
] as const;
