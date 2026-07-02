import type { MarkType, Schema } from 'prosemirror-model';
import type { Command } from 'prosemirror-state';
import type { MoongladeEditorCommands } from './commands';
import { type CodeDialogElements, type EditorDialogActions, type LinkDialogElements, type SourceDialogElements } from './dialogs';
export type ToolbarButtonId = 'undo' | 'redo' | 'bold' | 'italic' | 'underline' | 'strike' | 'blockquote' | 'bulletList' | 'orderedList' | 'alignLeft' | 'alignCenter' | 'alignRight' | 'alignJustify' | 'codeBlock' | 'horizontalRule' | 'insertTable' | 'addTableRow' | 'deleteTableRow' | 'addTableColumn' | 'deleteTableColumn' | 'toggleTableHeaderRow' | 'deleteTable' | 'link' | 'image' | 'htmlSource';
export type ToolbarButtons = Record<ToolbarButtonId, HTMLButtonElement>;
export interface ToolbarElements {
    root: HTMLDivElement;
    formatSelect: HTMLSelectElement;
    buttons: ToolbarButtons;
    colorDropdowns: ColorDropdown[];
    imageInput: HTMLInputElement;
    uploadStatus: HTMLDivElement;
    linkDialog: LinkDialogElements;
    codeDialog: CodeDialogElements;
    sourceDialog: SourceDialogElements;
}
export interface ColorDropdown {
    button: HTMLButtonElement;
    preview: HTMLSpanElement;
    menu: HTMLDivElement;
    markType: MarkType;
    commands: Map<string, Command>;
    colorButtons: Map<string, HTMLButtonElement>;
    clearButton: HTMLButtonElement;
    clearCommand: Command;
}
interface CreateToolbarOptions {
    schema: Schema;
    commands: MoongladeEditorCommands;
    uploadConfigured: boolean;
    actions: ToolbarActions;
}
interface ToolbarActions extends EditorDialogActions {
    execute(command: Command): void;
    saveSelection(): void;
    uploadFile(file: File): void;
    openLinkDialog(): void;
    openCodeDialog(): void;
    openSourceDialog(): void;
}
export declare function createToolbar({ schema, commands, uploadConfigured, actions }: CreateToolbarOptions): ToolbarElements;
export declare function closeColorDropdowns(toolbar: Pick<ToolbarElements, 'colorDropdowns'>, except?: ColorDropdown): void;
export declare function getFirstImageFile(files: FileList | null | undefined): File | null;
export {};
//# sourceMappingURL=toolbar.d.ts.map