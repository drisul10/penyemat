import { describe, expect, it } from 'vitest';
import { normalizeUrl, parseUserUrl, siteOf } from '../../src/lib/url';

describe('normalizeUrl', () => {
  it('lowercases the host, drops the fragment and tracking params, keeps the path', () => {
    expect(normalizeUrl('https://Recipes.Example.com/Pasta/Lemon?utm_source=x&id=4&fbclid=9&gclid=2#step-3')).toBe(
      'https://recipes.example.com/Pasta/Lemon?id=4',
    );
  });
  it('treats two saves that differ only in tracking params as the same page', () => {
    expect(normalizeUrl('https://example.com/a?utm_medium=mail')).toBe(normalizeUrl('https://EXAMPLE.com/a#top'));
  });
  it('leaves other query params untouched', () => {
    expect(normalizeUrl('https://example.com/s?q=a+b&page=2')).toBe('https://example.com/s?q=a+b&page=2');
  });
});

describe('siteOf and parseUserUrl', () => {
  it('drops www from the site line', () => {
    expect(siteOf('https://www.example.com/x')).toBe('example.com');
  });
  it('accepts only full http(s) addresses', () => {
    expect(parseUserUrl('recipes.example')).toBeNull();
    expect(parseUserUrl('https://recipes')).toBeNull();
    expect(parseUserUrl(' https://recipes.example.com/a ')).toBe('https://recipes.example.com/a');
  });
});
