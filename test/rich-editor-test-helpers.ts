import { afterEach, vi } from 'vitest';
import type { MoongladeEditor } from '../src/editor';

const emptyClientRects = {
  length: 0,
  item: () => null,
  [Symbol.iterator]: function* iterator() {
    return;
  }
} as DOMRectList;

let rangeMocksInstalled = false;

export function installRichEditorTestEnvironment(): void {
  if (!rangeMocksInstalled) {
    Range.prototype.getClientRects = () => emptyClientRects;
    Range.prototype.getBoundingClientRect = () => new DOMRect();
    rangeMocksInstalled = true;
  }

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });
}

export function waitForAsyncWork(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export async function waitForExpectation(assertion: () => void): Promise<void> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await waitForAsyncWork();
    }
  }

  throw lastError;
}

export function createClipboardImagePasteEvent(file: File): ClipboardEvent {
  const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;

  Object.defineProperty(event, 'clipboardData', {
    configurable: true,
    value: {
      files: [],
      items: [
        {
          kind: 'file',
          type: file.type,
          getAsFile: () => file
        }
      ]
    }
  });

  return event;
}

export function mockElementRect(element: Element, rect: { left: number; top: number; width: number; height: number }): void {
  const domRect = {
    ...rect,
    x: rect.left,
    y: rect.top,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    toJSON: () => ({})
  } as DOMRect;

  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(domRect);
}

type EditorWithSourceDialog = MoongladeEditor & {
  toolbar: {
    sourceDialog: {
      getValue(): string;
      setValue(value: string): Promise<void>;
    };
  };
};

export function getSourceDialog(editor: MoongladeEditor): EditorWithSourceDialog['toolbar']['sourceDialog'] {
  return (editor as unknown as EditorWithSourceDialog).toolbar.sourceDialog;
}
