import { Schema, type NodeSpec } from 'prosemirror-model';
import { schema as basicSchema } from 'prosemirror-schema-basic';
import { addListNodes } from 'prosemirror-schema-list';
import { tableNodes } from 'prosemirror-tables';
import { sanitizeStyleValue, sanitizeTextAlign } from './safety';

const nodes = addListNodes(
  basicSchema.spec.nodes
    .update('paragraph', withAlignment(basicSchema.spec.nodes.get('paragraph')!))
    .update('heading', withAlignment(basicSchema.spec.nodes.get('heading')!)),
  'paragraph block*',
  'block'
).append(
  tableNodes({
    tableGroup: 'block',
    cellContent: 'block+',
    cellAttributes: {
      align: {
        default: null,
        getFromDOM(dom) {
          return sanitizeTextAlign(dom.style.textAlign || dom.getAttribute('align')) || null;
        },
        setDOMAttr(value, attrs) {
          if (value) {
            attrs.style = `${attrs.style || ''}text-align: ${value};`;
          }
        }
      }
    }
  })
);

const marks = basicSchema.spec.marks
  .append({
    underline: {
      parseDOM: [
        { tag: 'u' },
        {
          style: 'text-decoration',
          getAttrs: (value) => typeof value === 'string' && value.includes('underline') ? null : false
        }
      ],
      toDOM: () => ['u', 0]
    },
    strike: {
      parseDOM: [
        { tag: 's' },
        { tag: 'del' },
        {
          style: 'text-decoration',
          getAttrs: (value) => typeof value === 'string' && value.includes('line-through') ? null : false
        }
      ],
      toDOM: () => ['s', 0]
    },
    text_color: {
      attrs: { color: {} },
      parseDOM: [
        {
          style: 'color',
          getAttrs: (value) => {
            const color = typeof value === 'string' ? sanitizeStyleValue(value) : false;
            return color ? { color } : false;
          }
        }
      ],
      toDOM: (mark) => ['span', { style: `color: ${mark.attrs.color};` }, 0]
    },
    background_color: {
      attrs: { color: {} },
      parseDOM: [
        {
          style: 'background-color',
          getAttrs: (value) => {
            const color = typeof value === 'string' ? sanitizeStyleValue(value) : false;
            return color ? { color } : false;
          }
        }
      ],
      toDOM: (mark) => ['span', { style: `background-color: ${mark.attrs.color};` }, 0]
    }
  });

export const moongladeSchema = new Schema({
  nodes,
  marks
});

export type MoongladeSchema = typeof moongladeSchema;

function withAlignment(spec: NodeSpec): NodeSpec {
  return {
    ...spec,
    attrs: {
      ...spec.attrs,
      align: { default: null }
    },
    parseDOM: spec.parseDOM?.map((rule) => ({
      ...rule,
      getAttrs(dom) {
        const originalAttrs = typeof rule.getAttrs === 'function'
          ? rule.getAttrs(dom)
          : rule.attrs ?? null;

        if (originalAttrs === false) {
          return false;
        }

        const element = dom instanceof HTMLElement ? dom : null;
        const align = sanitizeTextAlign(element?.style.textAlign || element?.getAttribute('align'));
        return {
          ...(originalAttrs || {}),
          align: align || null
        };
      }
    })),
    toDOM(node) {
      const dom = spec.toDOM?.(node) ?? ['p', 0];
      const align = sanitizeTextAlign(node.attrs.align);

      if (!Array.isArray(dom) || !align) {
        return dom;
      }

      const attrs = typeof dom[1] === 'object' && !Array.isArray(dom[1])
        ? { ...(dom[1] as Record<string, string>) }
        : {};
      attrs.style = `${attrs.style || ''}text-align: ${align};`;

      return typeof dom[1] === 'object' && !Array.isArray(dom[1])
        ? [dom[0], attrs, ...dom.slice(2)]
        : [dom[0], attrs, ...dom.slice(1)];
    }
  };
}
