import { hasAllowedImageUploadExtension } from '../image-upload';

export function getFirstImageFile(files: FileList | File[] | null | undefined, allowedImageExtensions: readonly string[]): File | null {
  return Array.from(files ?? []).find((file) => file.type.startsWith('image/') || hasAllowedImageUploadExtension(file, allowedImageExtensions)) ?? null;
}
