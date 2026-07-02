export type TextAlignment = 'left' | 'center' | 'right' | 'justify';
export declare function isSafeUrl(value: string): boolean;
export declare function sanitizeUrl(value: string): string | false;
export declare function sanitizeLinkUrl(value: string): string | false;
export declare function sanitizeImageUrl(value: string): string | false;
export declare function sanitizeStyleValue(value: string): string | false;
export declare function sanitizeTextAlign(value: string | null | undefined): TextAlignment | false;
export declare function sanitizeCodeLanguage(value: string | null | undefined): string | false;
//# sourceMappingURL=safety.d.ts.map