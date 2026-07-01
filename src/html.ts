import { DOMParser as ProseMirrorDOMParser, DOMSerializer, type Node as ProseMirrorNode, type Schema } from 'prosemirror-model';
import { sanitizeImageUrl, sanitizeLinkUrl } from './safety';

const BLOCK_TAGS = new Set([
  'ADDRESS',
  'ARTICLE',
  'ASIDE',
  'BLOCKQUOTE',
  'DD',
  'DIV',
  'DL',
  'DT',
  'FIGCAPTION',
  'FIGURE',
  'FOOTER',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HEADER',
  'HR',
  'LI',
  'MAIN',
  'NAV',
  'OL',
  'P',
  'PRE',
  'SECTION',
  'TABLE',
  'TBODY',
  'TD',
  'TFOOT',
  'TH',
  'THEAD',
  'TR',
  'UL'
]);

const VOID_TAGS = new Set(['AREA', 'BASE', 'BR', 'COL', 'EMBED', 'HR', 'IMG', 'INPUT', 'LINK', 'META', 'PARAM', 'SOURCE', 'TRACK', 'WBR']);
const PREFORMATTED_TAGS = new Set(['PRE', 'CODE']);
const INDENT = '  ';

function removeUnsafeAttributes(root: HTMLElement): void {
  for (const element of Array.from(root.querySelectorAll('*'))) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value;

      if (name.startsWith('on')) {
        element.removeAttribute(attribute.name);
        continue;
      }

      if (name === 'href') {
        const safeHref = sanitizeLinkUrl(value);
        if (!safeHref) {
          element.removeAttribute(attribute.name);
          continue;
        }

        element.setAttribute(attribute.name, safeHref);
        continue;
      }

      if (name === 'src') {
        const safeSrc = sanitizeImageUrl(value);
        if (!safeSrc) {
          element.removeAttribute(attribute.name);
          continue;
        }

        element.setAttribute(attribute.name, safeSrc);
      }
    }
  }
}

export function parseHtml(schema: Schema, html: string): ProseMirrorNode {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html || '';
  removeUnsafeAttributes(wrapper);

  return ProseMirrorDOMParser.fromSchema(schema).parse(wrapper);
}

export function serializeHtml(schema: Schema, doc: ProseMirrorNode): string {
  const serializer = DOMSerializer.fromSchema(schema);
  const fragment = serializer.serializeFragment(doc.content);
  const wrapper = document.createElement('div');
  wrapper.appendChild(fragment);

  for (const image of Array.from(wrapper.querySelectorAll('img'))) {
    if (!image.hasAttribute('loading')) {
      image.setAttribute('loading', 'lazy');
    }
  }

  return formatHtml(wrapper);
}

export function roundTripHtml(schema: Schema, html: string): string {
  return serializeHtml(schema, parseHtml(schema, html));
}

function formatHtml(root: HTMLElement): string {
  return Array.from(root.childNodes)
    .map((node) => formatNode(node, 0))
    .filter(Boolean)
    .join('\n');
}

function formatNode(node: ChildNode, depth: number): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent?.trim() || '';
  }

  if (!(node instanceof HTMLElement)) {
    return '';
  }

  if (PREFORMATTED_TAGS.has(node.tagName) || VOID_TAGS.has(node.tagName)) {
    return `${INDENT.repeat(depth)}${node.outerHTML}`;
  }

  if (isImageOnlyParagraph(node)) {
    const imageLines = Array.from(node.children)
      .map((child) => `${INDENT.repeat(depth + 1)}${child.outerHTML}`)
      .join('\n');
    return `${INDENT.repeat(depth)}${openTag(node)}\n${imageLines}\n${INDENT.repeat(depth)}</${node.tagName.toLowerCase()}>`;
  }

  if (!hasOnlyBlockChildren(node)) {
    return `${INDENT.repeat(depth)}${node.outerHTML}`;
  }

  const childLines = Array.from(node.childNodes)
    .map((child) => formatNode(child, depth + 1))
    .filter(Boolean)
    .join('\n');

  if (!childLines) {
    return `${INDENT.repeat(depth)}${node.outerHTML}`;
  }

  return `${INDENT.repeat(depth)}${openTag(node)}\n${childLines}\n${INDENT.repeat(depth)}</${node.tagName.toLowerCase()}>`;
}

function hasOnlyBlockChildren(element: HTMLElement): boolean {
  let hasBlockChild = false;

  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      if (child.textContent?.trim()) {
        return false;
      }
      continue;
    }

    if (!(child instanceof HTMLElement) || !BLOCK_TAGS.has(child.tagName)) {
      return false;
    }

    hasBlockChild = true;
  }

  return hasBlockChild;
}

function isImageOnlyParagraph(element: HTMLElement): boolean {
  if (element.tagName !== 'P') {
    return false;
  }

  const children = Array.from(element.childNodes);
  return children.length > 0 && children.every((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      return !child.textContent?.trim();
    }

    return child instanceof HTMLImageElement;
  });
}

function openTag(element: HTMLElement): string {
  const tagName = element.tagName.toLowerCase();
  const attributes = Array.from(element.attributes)
    .map((attribute) => ` ${attribute.name}="${escapeAttributeValue(attribute.value)}"`)
    .join('');

  return `<${tagName}${attributes}>`;
}

function escapeAttributeValue(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}
