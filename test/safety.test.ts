import { describe, expect, it } from 'vitest';
import {
  isSafeUrl,
  sanitizeImageUrl,
  sanitizeLinkUrl,
  sanitizeCodeLanguage,
  sanitizeStyleValue,
  sanitizeTextAlign,
  sanitizeUrl
} from '../src/safety';

describe('safety helpers', () => {
  it('rejects empty and script-like URLs', () => {
    expect(isSafeUrl('')).toBe(false);
    expect(isSafeUrl('   ')).toBe(false);
    expect(sanitizeUrl('javascript:alert(1)')).toBe(false);
    expect(sanitizeLinkUrl(' vbscript:msgbox(1)')).toBe(false);
    expect(sanitizeLinkUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(sanitizeLinkUrl('ftp://example.com/file.txt')).toBe(false);
    expect(sanitizeLinkUrl('//example.com/post')).toBe(false);
  });

  it('keeps allow-listed link URLs', () => {
    expect(sanitizeLinkUrl(' https://example.com/post ')).toBe('https://example.com/post');
    expect(sanitizeLinkUrl('mailto:hello@example.com')).toBe('mailto:hello@example.com');
    expect(sanitizeLinkUrl('tel:+15551234567')).toBe('tel:+15551234567');
    expect(sanitizeLinkUrl('/posts/hello-world')).toBe('/posts/hello-world');
    expect(sanitizeLinkUrl('../archive')).toBe('../archive');
    expect(sanitizeLinkUrl('#comments')).toBe('#comments');
  });

  it('keeps only image-appropriate URLs for images', () => {
    expect(sanitizeImageUrl('/media/photo.jpg')).toBe('/media/photo.jpg');
    expect(sanitizeImageUrl('images/photo.jpg')).toBe('images/photo.jpg');
    expect(sanitizeImageUrl('https://cdn.example.com/photo.jpg')).toBe('https://cdn.example.com/photo.jpg');
    expect(sanitizeImageUrl('mailto:hello@example.com')).toBe(false);
    expect(sanitizeImageUrl('data:image/png;base64,abc')).toBe(false);
    expect(sanitizeImageUrl('//cdn.example.com/photo.jpg')).toBe(false);
  });

  it('rejects URLs containing embedded whitespace or control characters', () => {
    expect(sanitizeLinkUrl('https://example.com/a b')).toBe(false);
    expect(sanitizeLinkUrl('java\nscript:alert(1)')).toBe(false);
    expect(sanitizeImageUrl('/media/photo\u0000.jpg')).toBe(false);
  });

  it('sanitizes supported style color values', () => {
    expect(sanitizeStyleValue(' #0d6efd ')).toBe('#0d6efd');
    expect(sanitizeStyleValue('rgb(13, 110, 253)')).toBe('rgb(13, 110, 253)');
    expect(sanitizeStyleValue('rgba(13, 110, 253, 0.5)')).toBe('rgba(13, 110, 253, 0.5)');
  });

  it('rejects unsupported, executable, or invalid color values', () => {
    expect(sanitizeStyleValue('url(javascript:alert(1))')).toBe(false);
    expect(sanitizeStyleValue('expression(alert(1))')).toBe(false);
    expect(sanitizeStyleValue('transparent')).toBe(false);
    expect(sanitizeStyleValue('rgb(256, 110, 253)')).toBe(false);
    expect(sanitizeStyleValue('rgba(13, 110, 253, 2)')).toBe(false);
    expect(sanitizeStyleValue('a'.repeat(65))).toBe(false);
  });

  it('normalizes constrained text alignment values', () => {
    expect(sanitizeTextAlign(' Center ')).toBe('center');
    expect(sanitizeTextAlign('justify')).toBe('justify');
    expect(sanitizeTextAlign('match-parent')).toBe(false);
  });

  it('normalizes constrained code language values', () => {
    expect(sanitizeCodeLanguage(' TypeScript ')).toBe('typescript');
    expect(sanitizeCodeLanguage('csharp')).toBe('csharp');
    expect(sanitizeCodeLanguage('javascript:alert(1)')).toBe(false);
  });
});
