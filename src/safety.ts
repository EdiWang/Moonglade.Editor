const protocolPattern = /^([a-z][a-z0-9+.-]*):/i;
const unsafeUrlCharacterPattern = /[\u0000-\u001f\u007f\s]/;
const safeLinkProtocols = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const safeImageProtocols = new Set(['http:', 'https:']);
const safeTextAlignValues = new Set(['left', 'center', 'right', 'justify']);
const codeLanguagePattern = /^[a-z0-9_+-]{1,32}$/i;

export type TextAlignment = 'left' | 'center' | 'right' | 'justify';

export function isSafeUrl(value: string): boolean {
  return Boolean(sanitizeLinkUrl(value));
}

export function sanitizeUrl(value: string): string | false {
  return sanitizeLinkUrl(value);
}

export function sanitizeLinkUrl(value: string): string | false {
  return sanitizeUrlWithProtocols(value, safeLinkProtocols);
}

export function sanitizeImageUrl(value: string): string | false {
  return sanitizeUrlWithProtocols(value, safeImageProtocols);
}

export function sanitizeStyleValue(value: string): string | false {
  const normalized = value.trim();
  if (!normalized || normalized.length > 64) {
    return false;
  }

  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(normalized)) {
    return normalized;
  }

  if (isSafeRgbColor(normalized)) {
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

function sanitizeUrlWithProtocols(value: string, allowedProtocols: Set<string>): string | false {
  const normalized = value.trim();

  if (!normalized || normalized.startsWith('//') || unsafeUrlCharacterPattern.test(normalized)) {
    return false;
  }

  const protocol = normalized.match(protocolPattern)?.[1]?.toLowerCase();
  if (!protocol) {
    return normalized;
  }

  return allowedProtocols.has(`${protocol}:`) ? normalized : false;
}

function isSafeRgbColor(value: string): boolean {
  const rgb = value.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/i);
  if (!rgb) {
    return false;
  }

  const channels = rgb.slice(1, 4).map(Number);
  if (channels.some((channel) => channel < 0 || channel > 255)) {
    return false;
  }

  const alpha = rgb[4];
  return !alpha || Number(alpha) >= 0 && Number(alpha) <= 1;
}
