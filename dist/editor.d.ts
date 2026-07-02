import type { Node as ProseMirrorNode, Schema } from 'prosemirror-model';
import { type Command } from 'prosemirror-state';
import { type MoongladeEditorCommands } from './commands';
import { type MoongladeImageUploader } from './image-upload';
export interface MoongladeEditorOptions {
    element: HTMLElement;
    textarea?: HTMLTextAreaElement;
    content?: string;
    height?: string;
    schema?: Schema;
    spellcheck?: boolean;
    uploadUrl?: string;
    uploadImage?: MoongladeImageUploader;
    onChange?: (html: string) => void;
}
export declare class MoongladeEditor {
    readonly schema: Schema;
    readonly commands: MoongladeEditorCommands;
    readonly uploadUrl?: string;
    private readonly textarea?;
    private readonly onChange?;
    private readonly uploadImage?;
    private readonly toolbar;
    private spellcheck;
    private readonly closeColorDropdownsOnDocumentPointerDown;
    private savedSelection?;
    private view;
    constructor(options: MoongladeEditorOptions);
    get dom(): HTMLElement;
    get doc(): ProseMirrorNode;
    getHTML(): string;
    setHTML(html: string): void;
    run(command: Command): boolean;
    focus(): void;
    getSpellcheck(): boolean;
    setSpellcheck(enabled: boolean): void;
    destroy(): void;
    syncToTextarea(): void;
    private writeEditorValue;
    private handleImagePaste;
    private getEditorAttributes;
    private handleImageDrop;
    private uploadAndInsertImage;
    private setUploadStatus;
    private dispatch;
    private execute;
    private openLinkDialog;
    private openCodeDialog;
    private closeCodeDialog;
    private openSourceDialog;
    private closeSourceDialog;
    private closeLinkDialog;
    private executeWithSavedSelection;
    private restoreSavedSelection;
    private updateToolbarState;
}
export declare function createMoongladeEditor(options: MoongladeEditorOptions): MoongladeEditor;
//# sourceMappingURL=editor.d.ts.map