import { describe, expect, it } from 'vitest';
import { roundTripHtml } from '../src/html';
import { moongladeSchema } from '../src/schema';

describe('html parsing and serialization', () => {
  it('round-trips basic post content', () => {
    const html = '<h1>Hello</h1><p><strong>Moonglade</strong> editor</p>';

    expect(roundTripHtml(moongladeSchema, html)).toBe('<h1>Hello</h1><p><strong>Moonglade</strong> editor</p>');
  });

  it('supports underline, strike, and color marks', () => {
    const html = '<p><u>Under</u> <s>Strike</s> <span style="color: #0d6efd;">Blue</span> <span style="background-color: #ffc107;">Highlight</span></p>';

    expect(roundTripHtml(moongladeSchema, html)).toBe('<p><u>Under</u> <s>Strike</s> <span style="color: rgb(13, 110, 253);">Blue</span> <span style="background-color: rgb(255, 193, 7);">Highlight</span></p>');
  });

  it('strips unsafe link protocols', () => {
    const html = '<p><a href="javascript:alert(1)">bad link</a></p>';

    expect(roundTripHtml(moongladeSchema, html)).toBe('<p>bad link</p>');
  });

  it('drops unsafe color styles', () => {
    const html = '<p><span style="color: url(javascript:alert(1));">bad color</span></p>';

    expect(roundTripHtml(moongladeSchema, html)).toBe('<p>bad color</p>');
  });
});
