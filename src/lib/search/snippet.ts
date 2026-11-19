import { stem } from './tokenize';

// Snippet around the first match, about 160 characters, cut on word boundaries (F2.7).

export interface Snippet {
  text: string;
  /** [start, end) ranges inside `text` to highlight. */
  ranges: [number, number][];
}

const WORD = /[\p{L}\p{N}]+/gu;
const WINDOW = 160;

export function makeSnippet(text: string, matchedTerms: string[], size = WINDOW): Snippet | null {
  if (!text) return null;
  const terms = new Set(matchedTerms);
  const heads = [...new Set(matchedTerms.map((t) => t.slice(0, 3)))];
  const isMatch = (word: string): boolean => {
    const lower = word.toLowerCase();
    if (!heads.some((h) => lower.startsWith(h))) return false;
    return terms.has(stem(lower)) || terms.has(lower);
  };

  let first = -1;
  WORD.lastIndex = 0;
  for (let m = WORD.exec(text); m; m = WORD.exec(text)) {
    if (isMatch(m[0])) {
      first = m.index;
      break;
    }
  }

  let start = 0;
  if (first > size / 3) start = first - Math.floor(size / 3);
  let end = Math.min(text.length, start + size);
  // Snap to word boundaries.
  if (start > 0) {
    const space = text.indexOf(' ', start);
    if (space !== -1 && space < (first === -1 ? end : first)) start = space + 1;
  }
  if (end < text.length) {
    const space = text.lastIndexOf(' ', end);
    if (space > start + size / 2) end = space;
  }

  const raw = text.slice(start, end).replace(/\s+/g, ' ');
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  const body = `${prefix}${raw}${suffix}`;

  const ranges: [number, number][] = [];
  WORD.lastIndex = 0;
  for (let m = WORD.exec(body); m; m = WORD.exec(body)) {
    if (isMatch(m[0])) ranges.push([m.index, m.index + m[0].length]);
  }
  return { text: body, ranges };
}
