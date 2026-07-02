export interface MoongladeImageUploadResult {
  src: string;
  alt?: string;
  title?: string;
}

export type MoongladeImageUploader = (file: File) => Promise<MoongladeImageUploadResult>;

const invalidJsonMessage = 'Image upload failed because the server returned invalid JSON.';
const missingUrlMessage = 'Image upload response did not include an image URL.';

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
