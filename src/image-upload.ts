export interface MoongladeImageUploadResult {
  src: string;
  alt?: string;
  title?: string;
}

export type MoongladeImageUploader = (file: File) => Promise<MoongladeImageUploadResult>;

export const DEFAULT_ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.png', '.webp', '.svg'] as const;

const invalidJsonMessage = 'Image upload failed because the server returned invalid JSON.';
const missingUrlMessage = 'Image upload response did not include an image URL.';
const imageExtensionPattern = /^\.[a-z0-9]+$/;
const imageMimeExtensions = new Map([
  ['image/jpeg', ['.jpg', '.jpeg']],
  ['image/png', ['.png']],
  ['image/webp', ['.webp']],
  ['image/svg+xml', ['.svg']]
]);

interface CreateImageUploaderOptions {
  uploadUrl?: string;
  uploadImage?: MoongladeImageUploader;
}

export function createImageUploader({ uploadUrl, uploadImage }: CreateImageUploaderOptions): MoongladeImageUploader | undefined {
  if (uploadImage) {
    return uploadImage;
  }

  if (!uploadUrl) {
    return undefined;
  }

  return (file) => uploadImageToUrl(uploadUrl, file);
}

export function normalizeAllowedImageExtensions(extensions?: readonly string[]): string[] {
  const source = extensions ?? DEFAULT_ALLOWED_IMAGE_EXTENSIONS;
  const normalized: string[] = [];

  for (const extension of source) {
    const value = normalizeImageExtension(extension);
    if (value && !normalized.includes(value)) {
      normalized.push(value);
    }
  }

  return normalized;
}

export function hasAllowedImageUploadExtension(file: File, allowedExtensions: readonly string[]): boolean {
  const extension = getFileExtension(file.name);
  if (extension) {
    return allowedExtensions.includes(extension);
  }

  const mimeExtensions = imageMimeExtensions.get(file.type.toLowerCase());
  return Boolean(mimeExtensions?.some((mimeExtension) => allowedExtensions.includes(mimeExtension)));
}

export function formatAllowedImageExtensions(allowedExtensions: readonly string[]): string {
  return allowedExtensions.join(', ');
}

export async function uploadImageToUrl(uploadUrl: string, file: File): Promise<MoongladeImageUploadResult> {
  const formData = new FormData();
  formData.append('file', file, file.name);

  const response = await fetch(uploadUrl, {
    method: 'POST',
    body: formData,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Image upload failed with status ${response.status}.`);
  }

  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new Error(invalidJsonMessage);
  }

  if (!isObjectRecord(result) || typeof result.location !== 'string' || !result.location.trim()) {
    throw new Error(missingUrlMessage);
  }

  return {
    src: result.location,
    alt: typeof result.filename === 'string' ? result.filename : file.name,
    title: typeof result.title === 'string' ? result.title : undefined
  };
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeImageExtension(extension: string): string | null {
  const value = extension.trim().toLowerCase();
  const normalized = value.startsWith('.') ? value : `.${value}`;

  return imageExtensionPattern.test(normalized) ? normalized : null;
}

function getFileExtension(fileName: string): string | null {
  const extensionIndex = fileName.lastIndexOf('.');
  if (extensionIndex < 0 || extensionIndex === fileName.length - 1) {
    return null;
  }

  return fileName.slice(extensionIndex).toLowerCase();
}
