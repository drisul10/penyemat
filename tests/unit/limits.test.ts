import { describe, expect, it } from 'vitest';
import { capText, isPdf, isUnsavable, TEXT_CAP_BYTES } from '../../src/lib/extract/limits';

describe('capText (F1.7)', () => {
  it('stores the first 100 KB of a 300 KB page', () => {
    const text = 'a'.repeat(300 * 1024);
    expect(new TextEncoder().encode(capText(text)).length).toBe(TEXT_CAP_BYTES);
  });
  it('never splits a multi-byte character', () => {
    const text = 'é'.repeat(60 * 1024); // 2 bytes each, 120 KB
    const capped = capText(text);
    expect(capped).toBe('é'.repeat(50 * 1024));
  });
  it('keeps short text as is', () => {
    expect(capText('lemon zest')).toBe('lemon zest');
  });
});

describe('isUnsavable (F1.6) and isPdf (F1.5)', () => {
  it('refuses browser and store pages', () => {
    for (const url of [
      'chrome://settings',
      'about:newtab',
      'edge://newtab',
      'chrome-extension://abc/library.html',
      'https://chromewebstore.google.com/detail/x',
      'https://addons.mozilla.org/en-US/firefox/',
      undefined,
    ]) {
      expect(isUnsavable(url)).toBe(true);
    }
    expect(isUnsavable('https://recipes.example.com/pasta')).toBe(false);
  });
  it('detects PDFs by path or content type', () => {
    expect(isPdf('https://example.com/menu.PDF')).toBe(true);
    expect(isPdf('https://example.com/menu', 'application/pdf')).toBe(true);
    expect(isPdf('https://example.com/menu')).toBe(false);
  });
});
