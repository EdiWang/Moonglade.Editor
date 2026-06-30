const unsafeProtocolPattern = /^\s*(?:javascript|vbscript|data):/i;
const safeTextAlignValues = new Set(['left', 'center', 'right', 'justify']);
const codeLanguagePattern = /^[a-z0-9_+-]{1,32}$/i;

export type TextAlignment = 'left' | 'center' | 'right' | 'justify';

export function isSafeUrl(value: string): boolean {
  const normalized = value.trim();
  return normalized.length > 0 && !unsafeProtocolPattern.test(normalized);
}

export function sanitizeUrl(value: string): string | false {
  const normalized = value.trim();
  return isSafeUrl(normalized) ? normalized : false;
}

export function sanitizeStyleValue(value: string): string | false {
  const normalized = value.trim();
  if (!normalized || normalized.length > 64) {
    return false;
  }

  if (/^#[0-9a-f]{3,8}$/i.test(normalized)) {
    return normalized;
  }

  if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i.test(normalized)) {
    return normalized;
  }

  if (/^[a-z]+$/i.test(normalized)) {
    return normalized;
  }

  return false;
}

export function sanitizeTextAlign(value: string | null | undefined): TextAlignment | false {
  const normalized = value?.trim().toLowerCase();
  return normalized && safeTextAlignValues.has(normalized)
    ? normalized as TextAlignment
    : false;
}

export function sanitizeCodeLanguage(value: string | null | undefined): string | false {
  const normalized = value?.trim().toLowerCase();
  return normalized && codeLanguagePattern.test(normalized)
    ? normalized
    : false;
}
