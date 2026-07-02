import type { Command } from 'prosemirror-state';
import type { MoongladeEditorCommands } from './commands';
export interface EditorDialogActions {
    executeWithSavedSelection(command: Command): boolean;
    closeLinkDialog(restoreSelection: boolean): void;
    closeCodeDialog(restoreSelection: boolean): void;
    closeSourceDialog(focusEditor: boolean): void;
    applySourceHtml(html: string): void;
}
export interface LinkDialogElements {
    root: HTMLDivElement;
    form: HTMLFormElement;
    hrefInput: HTMLInputElement;
    titleInput: HTMLInputElement;
    error: HTMLDivElement;
    removeButton: HTMLButtonElement;
    cancelButton: HTMLButtonElement;
}
export interface CodeDialogElements {
    root: HTMLDivElement;
    form: HTMLFormElement;
    languageSelect: HTMLSelectElement;
    cancelButton: HTMLButtonElement;
}
export interface SourceDialogElements {
    root: HTMLDivElement;
    form: HTMLFormElement;
    sourceTextarea: HTMLTextAreaElement;
    cancelButton: HTMLButtonElement;
}
export declare function createLinkDialog(commands: MoongladeEditorCommands, actions: EditorDialogActions): LinkDialogElements;
export declare function createCodeDialog(commands: MoongladeEditorCommands, actions: EditorDialogActions): CodeDialogElements;
export declare function createSourceDialog(actions: EditorDialogActions): SourceDialogElements;
//# sourceMappingURL=dialogs.d.ts.map