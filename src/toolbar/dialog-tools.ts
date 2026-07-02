import {
  createCodeDialog,
  createLinkDialog,
  createSourceDialog,
  type CodeDialogElements,
  type LinkDialogElements,
  type SourceDialogElements
} from '../dialogs';
import type { ToolbarContext } from './types';

export interface ToolbarDialogElements {
  linkDialog: LinkDialogElements;
  codeDialog: CodeDialogElements;
  sourceDialog: SourceDialogElements;
}

export function createToolbarDialogs(context: ToolbarContext): ToolbarDialogElements {
  return {
    linkDialog: createLinkDialog(context.commands, context.actions),
    codeDialog: createCodeDialog(context.commands, context.actions, context.codeSampleLanguages),
    sourceDialog: createSourceDialog(context.actions)
  };
}
