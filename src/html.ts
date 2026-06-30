import { DOMParser as ProseMirrorDOMParser, DOMSerializer, type Node as ProseMirrorNode, type Schema } from 'prosemirror-model';
import { isSafeUrl } from './safety';

function removeUnsafeAttributes(root: HTMLElement): void {
  for (const element of Array.from(root.querySelectorAll('*'))) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value;

      if (name.startsWith('on')) {
        element.removeAttribute(attribute.name);
        continue;
      }

      if ((name === 'href' || name === 'src') && !isSafeUrl(value)) {
        element.removeAttribute(attribute.name);
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

  return wrapper.innerHTML;
}

export function roundTripHtml(schema: Schema, html: string): string {
  return serializeHtml(schema, parseHtml(schema, html));
}
