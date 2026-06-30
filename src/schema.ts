import { Schema } from 'prosemirror-model';
import { schema as basicSchema } from 'prosemirror-schema-basic';
import { addListNodes } from 'prosemirror-schema-list';
import { tableNodes } from 'prosemirror-tables';

function safeStyleValue(value: string): string | false {
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

const nodes = addListNodes(
  basicSchema.spec.nodes,
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
          return dom.style.textAlign || dom.getAttribute('align') || null;
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
            const color = typeof value === 'string' ? safeStyleValue(value) : false;
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
            const color = typeof value === 'string' ? safeStyleValue(value) : false;
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
