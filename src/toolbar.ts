import { createAlignmentTools } from './toolbar/alignment-tools';
import { createBlockTools } from './toolbar/block-tools';
import { closeColorDropdowns, createColorTools } from './toolbar/color-tools';
import { createToolbarDialogs } from './toolbar/dialog-tools';
import { createFormatTool } from './toolbar/format-tool';
import { createHistoryTools } from './toolbar/history-tools';
import { createInlineFormatTools } from './toolbar/inline-format-tools';
import { createInsertionTools } from './toolbar/insertion-tools';
import { createSourceTool } from './toolbar/source-tool';
import { createUploadStatusTool } from './toolbar/status-tool';
import { closeTableDropdown, createTableTools } from './toolbar/table-tools';
import type {
  ColorDropdown,
  CreateToolbarOptions,
  TableDropdown,
  ToolbarButtonRegistry,
  ToolbarButtons,
  ToolbarContext,
  ToolbarElements
} from './toolbar/types';

export type {
  ColorDropdown,
  CreateToolbarOptions,
  TableDropdown,
  TableMenuPanel,
  ToolbarActions,
  ToolbarButtonId,
  ToolbarButtons,
  ToolbarElements
} from './toolbar/types';
export { closeColorDropdowns } from './toolbar/color-tools';
export { getFirstClipboardImageFile, getFirstImageFile } from './toolbar/image-files';
export { closeTableDropdown } from './toolbar/table-tools';

export function createToolbar(options: CreateToolbarOptions): ToolbarElements {
  const root = document.createElement('div');
  root.className = 'mg-editor-toolbar card-header btn-toolbar gap-2 p-2';
  root.setAttribute('role', 'toolbar');
  root.setAttribute('aria-label', 'Editor toolbar');

  const buttons: ToolbarButtonRegistry = {};
  const colorDropdowns: ColorDropdown[] = [];
  let tableDropdown: TableDropdown | undefined;

  const context: ToolbarContext = {
    ...options,
    buttons,
    colorDropdowns,
    closeColorDropdowns: (except?: ColorDropdown) => closeColorDropdowns({ colorDropdowns }, except),
    closeTableDropdown: () => {
      if (tableDropdown) {
        closeTableDropdown({ tableDropdown });
      }
    },
    toggleColorDropdown: (dropdown: ColorDropdown) => {
      const shouldOpen = dropdown.menu.hidden;
      closeColorDropdowns({ colorDropdowns }, dropdown);

      if (tableDropdown) {
        closeTableDropdown({ tableDropdown });
      }

      dropdown.menu.hidden = !shouldOpen;
      dropdown.button.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    }
  };

  const { group: formatGroup, formatSelect } = createFormatTool(context);
  const { group: insertionGroup } = createInsertionTools(context);
  tableDropdown = createTableTools(context);
  const uploadStatus = createUploadStatusTool();
  const sourceGroup = createSourceTool(context);
  const { imageDialog, linkDialog, codeDialog, sourceDialog } = createToolbarDialogs(context);

  root.append(
    createHistoryTools(context),
    formatGroup,
    createInlineFormatTools(context),
    createColorTools(context),
    createBlockTools(context),
    createAlignmentTools(context),
    insertionGroup,
    tableDropdown.root,
    uploadStatus,
    sourceGroup,
    imageDialog.root,
    linkDialog.root,
    codeDialog.root,
    sourceDialog.root
  );

  return {
    root,
    formatSelect,
    buttons: buttons as ToolbarButtons,
    colorDropdowns,
    tableDropdown,
    imageInput: imageDialog.fileInput,
    imageDialog,
    uploadStatus,
    linkDialog,
    codeDialog,
    sourceDialog
  };
}
