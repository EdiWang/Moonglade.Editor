import { Plugin, PluginKey, type SelectionBookmark } from 'prosemirror-state';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';

const uploadPreviewPluginKey = new PluginKey<DecorationSet>('moonglade-image-upload-preview');

type UploadPreviewMeta =
  | {
    type: 'add';
    id: number;
    pos: number;
    src: string;
    alt: string;
  }
  | {
    type: 'remove';
    id: number;
  };

export interface UploadPreviewHandle {
  id: number;
  objectUrl: string;
}

export function createUploadPreviewPlugin(): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: uploadPreviewPluginKey,
    state: {
      init: () => DecorationSet.empty,
      apply(transaction, decorations) {
        let nextDecorations = decorations.map(transaction.mapping, transaction.doc);
        const meta = transaction.getMeta(uploadPreviewPluginKey) as UploadPreviewMeta | undefined;

        if (!meta) {
          return nextDecorations;
        }

        if (meta.type === 'remove') {
          return nextDecorations.remove(nextDecorations.find(undefined, undefined, (spec) => spec.uploadPreviewId === meta.id));
        }

        const preview = Decoration.widget(meta.pos, () => {
          const root = document.createElement('span');
          root.className = 'mg-editor-upload-preview';
          root.contentEditable = 'false';

          const image = document.createElement('img');
          image.src = meta.src;
          image.alt = meta.alt;
          root.append(image);

          return root;
        }, {
          key: `mg-editor-upload-preview-${meta.id}`,
          side: -1,
          uploadPreviewId: meta.id
        });

        nextDecorations = nextDecorations.add(transaction.doc, [preview]);
        return nextDecorations;
      }
    },
    props: {
      decorations(state) {
        return uploadPreviewPluginKey.getState(state) ?? null;
      }
    }
  });
}

/**
 * Owns the in-progress upload preview widgets and their backing object URLs.
 * Preview decorations live in the `createUploadPreviewPlugin` state; this manager
 * dispatches the add/remove metadata and guarantees every created object URL is
 * revoked exactly once.
 */
export class UploadPreviewManager {
  private nextId = 1;
  private readonly objectUrls = new Map<number, string>();

  add(view: EditorView, file: File, uploadSelection: SelectionBookmark): UploadPreviewHandle | undefined {
    if (!file.type.startsWith('image/')) {
      return undefined;
    }

    const objectUrl = createObjectUrl(file);
    if (!objectUrl) {
      return undefined;
    }

    const id = this.nextId;
    this.nextId += 1;
    this.objectUrls.set(id, objectUrl);

    const selection = uploadSelection.resolve(view.state.doc);
    view.dispatch(view.state.tr.setMeta(uploadPreviewPluginKey, {
      type: 'add',
      id,
      pos: selection.from,
      src: objectUrl,
      alt: file.name || 'Uploading image'
    } satisfies UploadPreviewMeta));

    return { id, objectUrl };
  }

  remove(view: EditorView, preview: UploadPreviewHandle | undefined): void {
    if (!preview) {
      return;
    }

    view.dispatch(view.state.tr.setMeta(uploadPreviewPluginKey, {
      type: 'remove',
      id: preview.id
    } satisfies UploadPreviewMeta));
    this.revoke(preview.id);
  }

  getPosition(view: EditorView, id: number): number | undefined {
    const decorations = uploadPreviewPluginKey.getState(view.state);
    const preview = decorations?.find(undefined, undefined, (spec) => spec.uploadPreviewId === id)[0];
    return preview?.from;
  }

  clear(): void {
    for (const objectUrl of this.objectUrls.values()) {
      revokeObjectUrl(objectUrl);
    }

    this.objectUrls.clear();
  }

  private revoke(id: number): void {
    const objectUrl = this.objectUrls.get(id);
    if (!objectUrl) {
      return;
    }

    revokeObjectUrl(objectUrl);
    this.objectUrls.delete(id);
  }
}

function createObjectUrl(file: File): string | undefined {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return undefined;
  }

  return URL.createObjectURL(file);
}

function revokeObjectUrl(objectUrl: string): void {
  if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(objectUrl);
  }
}
