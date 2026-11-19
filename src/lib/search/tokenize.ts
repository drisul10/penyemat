import { stemmer } from 'stemmer';
import { STOP_WORDS } from './stopwords';

// One tokenizer for indexing, queries, and snippet matching (ARCHITECTURE 5.3).

const SPLIT = /[^\p{L}\p{N}]+/u;

/** Lowercased words, in order, with no stemming. */
export function words(text: string): string[] {
  return text.toLowerCase().split(SPLIT).filter(Boolean);
}

/** Stems a lowercased word. Numbers and very short words are left as they are. */
export function stem(word: string): string {
  if (word.length < 3 || /\d/.test(word)) return word;
  return stemmer(word);
}

export function isStopWord(word: string): boolean {
  return STOP_WORDS.has(word);
}

/** The page's distinct stemmed words, without stop words (ARCHITECTURE 5.3 "unique words"). */
export function uniqueBodyTerms(text: string): string[] {
  const seen = new Set<string>();
  for (const word of words(text)) {
    if (word.length > 40 || isStopWord(word)) continue;
    seen.add(stem(word));
  }
  return [...seen];
}

/** Terms for a title or address field: stop words are kept so "The Road" still matches. */
export function fieldTerms(text: string): string[] {
  return words(text).map(stem);
}

/** Address words: host parts and path segments, e.g. "recipes example com lemon pasta". */
export function addressText(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.replace(/^www\./, '')} ${decodeURIComponent(parsed.pathname)}`;
  } catch {
    return url;
  }
}
