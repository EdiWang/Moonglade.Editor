const protocolPattern = /^([a-z][a-z0-9+.-]*):/i;
const unsafeUrlCharacterPattern = /[\u0000-\u001f\u007f\s]/;
const unsafeClassCharacterPattern = /[\u0000-\u001f\u007f\s"'`=<>\\]/;
const safeLinkProtocols = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const safeImageProtocols = new Set(['http:', 'https:']);
const safeTextAlignValues = new Set(['left', 'center', 'right', 'justify']);
const codeLanguagePattern = /^[a-z0-9_+-]{1,32}$/i;
const maxClassAttributeLength = 1024;
const maxClassTokenLength = 128;

export type TextAlignment = 'left' | 'center' | 'right' | 'justify';

const bootstrapTextAlignmentClasses: Record<TextAlignment, string> = {
  left: 'text-start',
  center: 'text-center',
  right: 'text-end',
  justify: 'text-justify'
};

const textAlignmentByClass = new Map<string, TextAlignment>([
  ['text-start', 'left'],
  ['text-left', 'left'],
  ['text-center', 'center'],
  ['text-end', 'right'],
  ['text-right', 'right'],
  ['text-justify', 'justify']
]);

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

export function textAlignmentToClass(value: string | null | undefined): string | false {
  const align = sanitizeTextAlign(value);
  return align ? bootstrapTextAlignmentClasses[align] : false;
}

export function sanitizeTextAlignmentClass(value: string | null | undefined): TextAlignment | false {
  const className = sanitizeClassAttribute(value);
  if (!className) {
    return false;
  }

  for (const token of className.split(/\s+/)) {
    const align = textAlignmentByClass.get(token.toLowerCase());
    if (align) {
      return align;
    }
  }

  return false;
}

export function removeTextAlignmentClasses(value: string | null | undefined): string | false {
  const className = sanitizeClassAttribute(value);
  if (!className) {
    return false;
  }

  const classNames = className
    .split(/\s+/)
    .filter((token) => !textAlignmentByClass.has(token.toLowerCase()));

  return classNames.length > 0
    ? classNames.join(' ')
    : false;
}

export function sanitizeCodeLanguage(value: string | null | undefined): string | false {
  const normalized = value?.trim().toLowerCase();
  return normalized && codeLanguagePattern.test(normalized)
    ? normalized
    : false;
}

export function sanitizeClassAttribute(value: string | null | undefined): string | false {
  const normalized = value?.trim();
  if (!normalized) {
    return false;
  }

  const safeClasses = normalized.slice(0, maxClassAttributeLength)
    .split(/\s+/)
    .filter((className, index, classNames) =>
      className.length > 0 &&
      className.length <= maxClassTokenLength &&
      !unsafeClassCharacterPattern.test(className) &&
      classNames.indexOf(className) === index);

  return safeClasses.length > 0
    ? safeClasses.join(' ')
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
