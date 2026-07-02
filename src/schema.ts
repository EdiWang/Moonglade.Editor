import { Schema, type Attrs, type DOMOutputSpec, type MarkSpec, type NodeSpec, type ParseRule, type TagParseRule } from 'prosemirror-model';
import { schema as basicSchema } from 'prosemirror-schema-basic';
import { addListNodes } from 'prosemirror-schema-list';
import { tableNodes } from 'prosemirror-tables';
import {
  removeTextAlignmentClasses,
  sanitizeClassAttribute,
  sanitizeCodeLanguage,
  sanitizeStyleValue,
  sanitizeTextAlign,
  sanitizeTextAlignmentClass,
  textAlignmentToClass
} from './safety';

const tableNodeSpecs = tableNodes({
  tableGroup: 'block',
  cellContent: 'block+',
  cellAttributes: {
    align: {
      default: null,
      getFromDOM(dom) {
        return sanitizeTextAlign(dom.style.textAlign || dom.getAttribute('align')) ||
          sanitizeTextAlignmentClass(dom.getAttribute('class')) ||
          null;
      },
      setDOMAttr(value, attrs) {
        const alignClass = typeof value === 'string'
          ? textAlignmentToClass(value)
          : false;

        if (alignClass) {
          addClassToAttrs(attrs, alignClass);
        }
      }
    }
  }
});
for (const nodeName of Object.keys(tableNodeSpecs)) {
  tableNodeSpecs[nodeName as keyof typeof tableNodeSpecs] = withNodeClass(tableNodeSpecs[nodeName as keyof typeof tableNodeSpecs]);
}

const baseNodes = basicSchema.spec.nodes
  .update('paragraph', withNodeClass(withAlignment(basicSchema.spec.nodes.get('paragraph')!)))
  .update('heading', withNodeClass(withAlignment(basicSchema.spec.nodes.get('heading')!)))
  .update('blockquote', withNodeClass(basicSchema.spec.nodes.get('blockquote')!))
  .update('horizontal_rule', withNodeClass(basicSchema.spec.nodes.get('horizontal_rule')!))
  .update('code_block', withNodeClass(withCodeLanguage()))
  .update('image', withNodeClass(basicSchema.spec.nodes.get('image')!))
  .update('hard_break', withNodeClass(basicSchema.spec.nodes.get('hard_break')!));

const listNodeSpecs = addListNodes(
  baseNodes,
  'paragraph block*',
  'block'
);

const nodes = listNodeSpecs
  .update('ordered_list', withNodeClass(listNodeSpecs.get('ordered_list')!))
  .update('bullet_list', withNodeClass(listNodeSpecs.get('bullet_list')!))
  .update('list_item', withNodeClass(listNodeSpecs.get('list_item')!))
  .append(tableNodeSpecs);

const marks = basicSchema.spec.marks
  .update('link', withMarkClass(basicSchema.spec.marks.get('link')!))
  .update('em', withMarkClass(basicSchema.spec.marks.get('em')!))
  .update('strong', withMarkClass(basicSchema.spec.marks.get('strong')!))
  .update('code', withMarkClass(basicSchema.spec.marks.get('code')!))
  .append({
    underline: withMarkClass({
      parseDOM: [
        { tag: 'u' },
        {
          style: 'text-decoration',
          getAttrs: (value) => typeof value === 'string' && value.includes('underline') ? null : false
        }
      ],
      toDOM: () => ['u', 0]
    }),
    strike: withMarkClass({
      parseDOM: [
        { tag: 's' },
        { tag: 'del' },
        {
          style: 'text-decoration',
          getAttrs: (value) => typeof value === 'string' && value.includes('line-through') ? null : false
        }
      ],
      toDOM: () => ['s', 0]
    }),
    text_color: withMarkClass({
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
    }),
    background_color: withMarkClass({
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
    })
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
        const align = sanitizeTextAlign(element?.style.textAlign || element?.getAttribute('align')) ||
          sanitizeTextAlignmentClass(element?.getAttribute('class'));
        return {
          ...(originalAttrs || {}),
          align: align || null
        };
      }
    })),
    toDOM(node) {
      const dom = spec.toDOM?.(node) ?? ['p', 0];
      const alignClass = textAlignmentToClass(node.attrs.align);

      if (!Array.isArray(dom) || !alignClass) {
        return dom;
      }

      const attrs = getDomOutputAttrs(dom);
      addClassToAttrs(attrs, alignClass);

      return setDomOutputAttrs(dom, attrs);
    }
  };
}

type MutableAttrs = Record<string, unknown>;

function withNodeClass(spec: NodeSpec): NodeSpec {
  return {
    ...spec,
    attrs: {
      ...spec.attrs,
      class: { default: null }
    },
    parseDOM: spec.parseDOM?.map(withClassTagParseRule),
    toDOM(node) {
      return addClassToDomOutput(spec.toDOM?.(node) ?? ['span', 0], node.attrs.class);
    }
  };
}

function withMarkClass(spec: MarkSpec): MarkSpec {
  return {
    ...spec,
    attrs: {
      ...spec.attrs,
      class: { default: null }
    },
    parseDOM: spec.parseDOM?.map(withClassParseRule),
    toDOM(mark, inline) {
      return addClassToDomOutput(spec.toDOM?.(mark, inline) ?? ['span', 0], mark.attrs.class);
    }
  };
}

function withClassParseRule(rule: ParseRule): ParseRule {
  return isTagParseRule(rule)
    ? withClassTagParseRule(rule)
    : rule;
}

function withClassTagParseRule(rule: TagParseRule): TagParseRule {
  const originalGetAttrs = rule.getAttrs;

  return {
    ...rule,
    getAttrs(dom: HTMLElement) {
      const originalAttrs = typeof originalGetAttrs === 'function'
        ? originalGetAttrs(dom)
        : rule.attrs ?? null;

      if (originalAttrs === false) {
        return false;
      }

      const className = hasAlignmentAttr(originalAttrs)
        ? removeTextAlignmentClasses(dom.getAttribute('class'))
        : sanitizeClassAttribute(dom.getAttribute('class'));
      return {
        ...(originalAttrs || {}),
        class: className || null
      };
    }
  };
}

function isTagParseRule(rule: ParseRule): rule is TagParseRule {
  return typeof rule.tag === 'string';
}

function addClassToDomOutput(dom: DOMOutputSpec, value: unknown): DOMOutputSpec {
  if (!Array.isArray(dom)) {
    return dom;
  }

  const attrs = getDomOutputAttrs(dom);
  addClassToAttrs(attrs, value);

  return setDomOutputAttrs(dom, attrs);
}

function addClassToAttrs(attrs: MutableAttrs, value: unknown): void {
  const className = mergeClassAttributes(attrs.class, value);

  if (className) {
    attrs.class = className;
  }
}

function mergeClassAttributes(...values: unknown[]): string | false {
  const classNames: string[] = [];

  for (const value of values) {
    const className = typeof value === 'string'
      ? sanitizeClassAttribute(value)
      : false;

    if (!className) {
      continue;
    }

    for (const token of className.split(/\s+/)) {
      if (!classNames.includes(token)) {
        classNames.push(token);
      }
    }
  }

  return classNames.length > 0
    ? classNames.join(' ')
    : false;
}

function hasAlignmentAttr(value: unknown): boolean {
  return Boolean(value && typeof value === 'object' && sanitizeTextAlign((value as Attrs).align));
}

function getDomOutputAttrs(dom: readonly unknown[]): MutableAttrs {
  return typeof dom[1] === 'object' && dom[1] !== null && !Array.isArray(dom[1])
    ? { ...(dom[1] as Attrs) } as MutableAttrs
    : {};
}

function setDomOutputAttrs(dom: readonly unknown[], attrs: MutableAttrs): DOMOutputSpec {
  const tagName = String(dom[0]);
  return typeof dom[1] === 'object' && dom[1] !== null && !Array.isArray(dom[1])
    ? [tagName, attrs, ...dom.slice(2)]
    : [tagName, attrs, ...dom.slice(1)];
}

function withCodeLanguage(): NodeSpec {
  return {
    content: 'text*',
    marks: '',
    group: 'block',
    code: true,
    defining: true,
    attrs: {
      language: { default: null }
    },
    parseDOM: [
      {
        tag: 'pre',
        preserveWhitespace: 'full',
        getAttrs(dom) {
          const element = dom instanceof HTMLElement ? dom : null;
          const code = element?.querySelector('code');
          const className = code?.getAttribute('class') || '';
          const language = className
            .split(/\s+/)
            .map((token) => token.match(/^(?:language|lang)-(.+)$/i)?.[1])
            .find(Boolean);

          return {
            language: sanitizeCodeLanguage(language) || null
          };
        }
      }
    ],
    toDOM(node) {
      const language = sanitizeCodeLanguage(node.attrs.language);
      const codeAttrs = language ? { class: `language-${language}` } : {};
      return ['pre', ['code', codeAttrs, 0]];
    }
  };
}
