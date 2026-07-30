import { hasAllowedImageUploadExtension } from '../image-upload';

export function getFirstImageFile(files: FileList | File[] | null | undefined, allowedImageExtensions: readonly string[]): File | null {
  return Array.from(files ?? []).find((file) => hasAllowedImageUploadExtension(file, allowedImageExtensions)) ?? null;
}

export function getFirstClipboardImageFile(clipboardData: DataTransfer | null | undefined, allowedImageExtensions: readonly string[]): File | null {
  const fileFromItems = getFirstImageFileFromItems(clipboardData?.items, allowedImageExtensions);
  return fileFromItems ?? getFirstImageFile(clipboardData?.files, allowedImageExtensions);
}

function getFirstImageFileFromItems(items: DataTransferItemList | null | undefined, allowedImageExtensions: readonly string[]): File | null {
  for (const item of Array.from(items ?? [])) {
    if (item.kind !== 'file') {
      continue;
    }

    const file = item.getAsFile();
    if (!file) {
      continue;
    }

    if (hasAllowedImageUploadExtension(file, allowedImageExtensions)) {
      return file;
    }
  }

  return null;
}
