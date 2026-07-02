import { type Node as ProseMirrorNode, type Schema } from 'prosemirror-model';
export declare function parseHtml(schema: Schema, html: string): ProseMirrorNode;
export declare function serializeHtml(schema: Schema, doc: ProseMirrorNode): string;
export declare function roundTripHtml(schema: Schema, html: string): string;
//# sourceMappingURL=html.d.ts.map