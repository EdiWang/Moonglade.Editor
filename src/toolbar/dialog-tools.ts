import {
  createCodeDialog,
  createImageDialog,
  createLinkDialog,
  createSourceDialog,
  type CodeDialogElements,
  type ImageDialogElements,
  type LinkDialogElements,
  type SourceDialogElements
} from '../dialogs';
import type { ToolbarContext } from './types';

export interface ToolbarDialogElements {
  imageDialog: ImageDialogElements;
  linkDialog: LinkDialogElements;
  codeDialog: CodeDialogElements;
  sourceDialog: SourceDialogElements;
}

export function createToolbarDialogs(context: ToolbarContext): ToolbarDialogElements {
  return {
    imageDialog: createImageDialog(context.actions, context.allowedImageExtensions),
    linkDialog: createLinkDialog(context.commands, context.actions),
    codeDialog: createCodeDialog(context.commands, context.actions, context.codeSampleLanguages),
    sourceDialog: createSourceDialog(context.actions)
  };
}
