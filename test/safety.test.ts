import { describe, expect, it } from 'vitest';
import {
  isSafeUrl,
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
    expect(sanitizeUrl(' vbscript:msgbox(1)')).toBe(false);
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
  });

  it('keeps ordinary absolute, root-relative, and fragment URLs', () => {
    expect(sanitizeUrl(' https://example.com/post ')).toBe('https://example.com/post');
    expect(sanitizeUrl('/media/photo.jpg')).toBe('/media/photo.jpg');
    expect(sanitizeUrl('#comments')).toBe('#comments');
  });

  it('sanitizes supported style color values', () => {
    expect(sanitizeStyleValue(' #0d6efd ')).toBe('#0d6efd');
    expect(sanitizeStyleValue('rgb(13, 110, 253)')).toBe('rgb(13, 110, 253)');
    expect(sanitizeStyleValue('transparent')).toBe('transparent');
  });

  it('rejects style values with executable or overly long content', () => {
    expect(sanitizeStyleValue('url(javascript:alert(1))')).toBe(false);
    expect(sanitizeStyleValue('expression(alert(1))')).toBe(false);
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
