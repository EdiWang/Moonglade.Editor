import { describe, expect, it } from 'vitest';
import { roundTripHtml } from '../src/html';
import { moongladeSchema } from '../src/schema';

describe('html parsing and serialization', () => {
  it('round-trips basic post content', () => {
    const html = '<h1>Hello</h1><p><strong>Moonglade</strong> editor</p>';

    expect(roundTripHtml(moongladeSchema, html)).toBe(`<h1>Hello</h1>
<p><strong>Moonglade</strong> editor</p>`);
  });

  it('round-trips horizontal rules', () => {
    const html = '<p>Before</p><hr><p>After</p>';

    expect(roundTripHtml(moongladeSchema, html)).toBe(`<p>Before</p>
<hr>
<p>After</p>`);
  });

  it('supports underline, strike, and color marks', () => {
    const html = '<p><u>Under</u> <s>Strike</s> <span style="color: #0d6efd;">Blue</span> <span style="background-color: #ffc107;">Highlight</span></p>';

    expect(roundTripHtml(moongladeSchema, html)).toBe('<p><u>Under</u> <s>Strike</s> <span style="color: rgb(13, 110, 253);">Blue</span> <span style="background-color: rgb(255, 193, 7);">Highlight</span></p>');
  });

  it('round-trips supported text alignment on paragraphs and headings', () => {
    const html = '<h2 style="text-align: center;">Centered</h2><p align="right">Right</p>';

    expect(roundTripHtml(moongladeSchema, html)).toBe(`<h2 style="text-align: center;">Centered</h2>
<p style="text-align: right;">Right</p>`);
  });

  it('round-trips code blocks with highlight.js-compatible language classes', () => {
    const html = '<pre><code class="language-csharp extra">Console.WriteLine("Hi");</code></pre>';

    expect(roundTripHtml(moongladeSchema, html)).toBe('<pre><code class="language-csharp">Console.WriteLine("Hi");</code></pre>');
  });

  it('round-trips basic tables', () => {
    const html = '<table><tbody><tr><th>Title</th><td>Value</td></tr></tbody></table>';

    expect(roundTripHtml(moongladeSchema, html)).toBe(`<table>
  <tbody>
    <tr>
      <th>
        <p>Title</p>
      </th>
      <td>
        <p>Value</p>
      </td>
    </tr>
  </tbody>
</table>`);
  });

  it('strips unsafe link protocols', () => {
    const html = '<p><a href="javascript:alert(1)">bad link</a> <a href="ftp://example.com/file.txt">ftp</a></p>';

    expect(roundTripHtml(moongladeSchema, html)).toBe('<p>bad link ftp</p>');
  });

  it('preserves allow-listed link protocols and relative links', () => {
    const html = '<p><a href="mailto:hello@example.com">Email</a> <a href="/posts/hello-world">Post</a> <a href="#comments">Comments</a></p>';

    expect(roundTripHtml(moongladeSchema, html)).toBe('<p><a href="mailto:hello@example.com">Email</a> <a href="/posts/hello-world">Post</a> <a href="#comments">Comments</a></p>');
  });

  it('normalizes safe URL attributes before parsing', () => {
    const html = '<p><a href=" https://example.com/post ">Post</a><img src=" /media/photo.jpg " alt="Photo"></p>';

    expect(roundTripHtml(moongladeSchema, html)).toBe('<p><a href="https://example.com/post">Post</a><img src="/media/photo.jpg" alt="Photo" loading="lazy"></p>');
  });

  it('drops unsafe color styles', () => {
    const html = '<p><span style="color: url(javascript:alert(1));">bad color</span> <span style="color: transparent;">named color</span></p>';

    expect(roundTripHtml(moongladeSchema, html)).toBe('<p>bad color named color</p>');
  });

  it('drops unsupported text alignment values', () => {
    const html = '<p style="text-align: match-parent;">bad alignment</p>';

    expect(roundTripHtml(moongladeSchema, html)).toBe('<p>bad alignment</p>');
  });

  it('drops unsupported code language values', () => {
    const html = '<pre><code class="language-javascript:alert(1)">bad()</code></pre>';

    expect(roundTripHtml(moongladeSchema, html)).toBe('<pre><code>bad()</code></pre>');
  });

  it('adds lazy loading to safe images and strips unsafe image URLs', () => {
    expect(roundTripHtml(moongladeSchema, '<p><img src="/media/photo.jpg" alt="Photo"></p>'))
      .toBe(`<p>
  <img src="/media/photo.jpg" alt="Photo" loading="lazy">
</p>`);
    expect(roundTripHtml(moongladeSchema, '<p><img src="javascript:alert(1)" alt="Bad"></p>'))
      .toBe('<p></p>');
    expect(roundTripHtml(moongladeSchema, '<p><img src="mailto:hello@example.com" alt="Bad"></p>'))
      .toBe('<p></p>');
  });

  it('keeps formatted output stable after another parse and serialize pass', () => {
    const html = '<h1>Hello</h1><p><strong>Moonglade</strong> editor</p><hr><p><img src="/media/photo.jpg" alt="Photo"></p>';
    const formatted = roundTripHtml(moongladeSchema, html);

    expect(roundTripHtml(moongladeSchema, formatted)).toBe(formatted);
  });
});
