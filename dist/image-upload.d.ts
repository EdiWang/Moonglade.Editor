export interface MoongladeImageUploadResult {
    src: string;
    alt?: string;
    title?: string;
}
export type MoongladeImageUploader = (file: File) => Promise<MoongladeImageUploadResult>;
interface CreateImageUploaderOptions {
    uploadUrl?: string;
    uploadImage?: MoongladeImageUploader;
}
export declare function createImageUploader({ uploadUrl, uploadImage }: CreateImageUploaderOptions): MoongladeImageUploader | undefined;
export declare function uploadImageToUrl(uploadUrl: string, file: File): Promise<MoongladeImageUploadResult>;
export {};
//# sourceMappingURL=image-upload.d.ts.map