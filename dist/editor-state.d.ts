import type { Mark, MarkType, NodeType } from 'prosemirror-model';
import type { Command, EditorState } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
export declare function canRun(state: EditorState, view: EditorView, command: Command): boolean;
export declare function firstCommand(commands: Map<string, Command>): Command | undefined;
export declare function getPaletteColor(value: unknown, commands: Map<string, Command>): string;
export declare function canEditLink(state: EditorState, activeLink: Mark | null): boolean;
export declare function getCurrentFormat(state: EditorState): string;
export declare function getCurrentAlignment(state: EditorState): string;
export declare function getCurrentCodeLanguage(state: EditorState): string;
export declare function hasAncestor(state: EditorState, nodeType: NodeType): boolean;
export declare function isMarkActive(state: EditorState, markType: MarkType): boolean;
export declare function getActiveMark(state: EditorState, markType: MarkType): Mark | null;
//# sourceMappingURL=editor-state.d.ts.map