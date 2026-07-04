import type { MarkType, Schema } from 'prosemirror-model';
import type { Command } from 'prosemirror-state';
import type { MoongladeEditorCommands } from '../commands';
import type {
  CodeDialogElements,
  EditorDialogActions,
  ImageDialogElements,
  LinkDialogElements,
  SourceDialogElements
} from '../dialogs';
import type { CodeSampleLanguageOption } from '../editor-options';

export type ToolbarButtonId =
  | 'undo'
  | 'redo'
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'blockquote'
  | 'bulletList'
  | 'orderedList'
  | 'alignLeft'
  | 'alignCenter'
  | 'alignRight'
  | 'alignJustify'
  | 'codeBlock'
  | 'horizontalRule'
  | 'insertTable'
  | 'addTableRow'
  | 'deleteTableRow'
  | 'addTableColumn'
  | 'deleteTableColumn'
  | 'toggleTableHeaderRow'
  | 'deleteTable'
  | 'link'
  | 'image'
  | 'htmlSource';

export type ToolbarButtons = Record<ToolbarButtonId, HTMLButtonElement>;
export type ToolbarButtonRegistry = Partial<ToolbarButtons>;

export interface ToolbarElements {
  root: HTMLDivElement;
  formatSelect: HTMLSelectElement;
  buttons: ToolbarButtons;
  colorDropdowns: ColorDropdown[];
  tableDropdown: TableDropdown;
  imageInput: HTMLInputElement;
  imageDialog: ImageDialogElements;
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

export type TableMenuPanel = 'insert' | 'row' | 'column';

export interface TableDropdown {
  root: HTMLDivElement;
  button: HTMLButtonElement;
  menu: HTMLDivElement;
  panels: Record<TableMenuPanel, HTMLDivElement>;
  panelButtons: Record<TableMenuPanel, HTMLButtonElement>;
  gridButtons: Map<string, HTMLButtonElement>;
  sizeLabel: HTMLSpanElement;
}

export interface CreateToolbarOptions {
  schema: Schema;
  commands: MoongladeEditorCommands;
  uploadConfigured: boolean;
  allowedImageExtensions: readonly string[];
  codeSampleLanguages: readonly CodeSampleLanguageOption[];
  actions: ToolbarActions;
}

export interface ToolbarActions extends EditorDialogActions {
  execute(command: Command): void;
  saveSelection(): void;
  openImageDialog(): void;
  openLinkDialog(): void;
  insertCode(): void;
  openCodeDialog(): void;
  openSourceDialog(): void;
}

export interface ToolbarContext extends CreateToolbarOptions {
  buttons: ToolbarButtonRegistry;
  colorDropdowns: ColorDropdown[];
  closeColorDropdowns(except?: ColorDropdown): void;
  closeTableDropdown(): void;
  toggleColorDropdown(dropdown: ColorDropdown): void;
}
