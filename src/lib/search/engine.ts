import MiniSearch, { type AsPlainObject, type Options, type Query, type SearchResult } from 'minisearch';
import { addressText, fieldTerms, stem, uniqueBodyTerms, words } from './tokenize';

// Search engine config (ARCHITECTURE 5.3). Shared by the search worker, tests, and the benchmark.

export const INDEX_SCHEMA_VERSION = 1;

export interface IndexDoc {
  id: string;
  title: string;
  site: string;
  words: string;
  savedAt: number;
}

export interface Hit {
  id: string;
  score: number;
  savedAt: number;
  /** 0: whole word, prefix, or typo match. 1: matched only inside a longer word. */
  tier: number;
  /** Indexed terms that matched, used to find the snippet. */
  terms: string[];
}

const OPTIONS: Options<IndexDoc> = {
  fields: ['title', 'site', 'words'],
  storeFields: ['savedAt'],
  // `words` is already a list of stemmed terms, so it is split on spaces and kept as is.
  tokenize: (text, fieldName) => (fieldName === 'words' ? text.split(' ').filter(Boolean) : words(text)),
  processTerm: (term, fieldName) => (fieldName === 'words' ? term : stem(term.toLowerCase())),
  searchOptions: {
    // Title > address > body (F2.6), decided weights.
    boost: { title: 3, site: 1.5, words: 1 },
    // 1 typo for 4+ letters, 2 typos for 8+ (F2.3).
    fuzzy: (term) => typoBudget(term),
    // Prefix matching on the last word typed (F2.4).
    prefix: (_term, i, terms) => i === terms.length - 1,
    combineWith: 'AND',
  },
};

/**
 * Every term ever indexed, for matching inside words. It only grows during a session; a term
 * whose pages were removed matches nothing, so it costs a lookup and nothing else.
 */
const vocabularies = new WeakMap<MiniSearch<IndexDoc>, Set<string>>();

function vocabularyOf(index: MiniSearch<IndexDoc>): Set<string> {
  let vocabulary = vocabularies.get(index);
  if (!vocabulary) {
    vocabulary = new Set();
    vocabularies.set(index, vocabulary);
  }
  return vocabulary;
}

export function createIndex(): MiniSearch<IndexDoc> {
  return new MiniSearch<IndexDoc>(OPTIONS);
}

/** Loads a snapshot. Its term list doubles as the vocabulary for inside-word matching. */
export function loadIndex(json: string): MiniSearch<IndexDoc> {
  const plain = JSON.parse(json) as AsPlainObject;
  const index = MiniSearch.loadJS<IndexDoc>(plain, OPTIONS);
  vocabularies.set(index, new Set(plain.index.map(([term]) => term)));
  return index;
}

export function toIndexDoc(page: { id: string; title: string; url: string; savedAt: number }, text: string): IndexDoc {
  return {
    id: page.id,
    title: page.title,
    site: addressText(page.url),
    words: uniqueBodyTerms(text).join(' '),
    savedAt: page.savedAt,
  };
}

/** Adds or replaces one document. */
export function upsert(index: MiniSearch<IndexDoc>, doc: IndexDoc): void {
  if (index.has(doc.id)) index.discard(doc.id);
  index.add(doc);
  const vocabulary = vocabularyOf(index);
  for (const term of fieldTerms(doc.title)) vocabulary.add(term);
  for (const term of fieldTerms(doc.site)) vocabulary.add(term);
  for (const term of doc.words.split(' ')) if (term) vocabulary.add(term);
}

export function remove(index: MiniSearch<IndexDoc>, id: string): void {
  if (index.has(id)) index.discard(id);
}

function toHits(results: SearchResult[], tier = 0): Hit[] {
  return results.map((r) => ({
    id: String(r.id),
    score: r.score,
    savedAt: Number(r.savedAt ?? 0),
    tier,
    terms: Object.keys(r.match),
  }));
}

/** Whole-word matches first, then inside-word matches; each by score, then newer saves (F2.6). */
export function rank<T extends Hit>(hits: T[]): T[] {
  return hits.sort((a, b) => a.tier - b.tier || b.score - a.score || b.savedAt - a.savedAt);
}

/** Shortest words that contain the typed word, e.g. "nikah" in "menikah" and "pernikahan". */
const INFIX_MIN = 3;
const INFIX_MAX_TERMS = 40;
const INFIX_WHEN_FEWER_THAN = 20;

function wordsContaining(index: MiniSearch<IndexDoc>, typed: string, stemmed: string): string[] {
  const found: string[] = [];
  for (const term of vocabularyOf(index)) {
    if (term !== stemmed && (term.includes(typed) || term.includes(stemmed))) found.push(term);
  }
  return found.sort((a, b) => a.length - b.length).slice(0, INFIX_MAX_TERMS);
}

/**
 * Matches inside longer words, like Typesense's infix search: "nikah" finds "Menikah".
 * Every typed word must match, either whole or inside another word.
 */
function searchInside(index: MiniSearch<IndexDoc>, query: string): Hit[] {
  const typed = words(query);
  if (!typed.length || typed.every((w) => w.length < INFIX_MIN)) return [];
  const queries: Query[] = typed.map((word) => {
    const stemmed = stem(word);
    const inside = word.length >= INFIX_MIN ? wordsContaining(index, word, stemmed) : [];
    return { combineWith: 'OR', queries: [stemmed, ...inside] };
  });
  const results = index.search(
    { combineWith: 'AND', queries },
    { fuzzy: false, prefix: false, processTerm: (t) => t, tokenize: (t) => [t] },
  );
  return toHits(results, 1);
}

const typoBudget = (term: string): number => (term.length >= 8 ? 2 : term.length >= 4 ? 1 : 0);

/**
 * Typos apply only to words with no exact match in the library, as in Typesense: "lemmon zest"
 * corrects "lemmon" but leaves "zest" alone, so it can't also match "best".
 * Words also match inside longer words, ranked after whole-word matches (searchInside).
 * All words must match. When that finds nothing and the query has several words,
 * any-word matches are returned instead, like Typesense dropping tokens.
 */
export function searchIndex(index: MiniSearch<IndexDoc>, query: string): Hit[] {
  const terms = fieldTerms(query);
  if (!terms.length) return [];
  const known = terms.map(
    (term) =>
      typoBudget(term) === 0 || index.search(term, { fuzzy: false, prefix: false, processTerm: (t) => t }).length > 0,
  );
  const fuzzy = (term: string, i: number) => (known[i] ? 0 : typoBudget(term));
  let hits = toHits(index.search(query, { fuzzy }));
  // Like Typesense's infix fallback: look inside longer words only when whole words found
  // less than a screen of pages. Those pages come after, without repeating a page.
  if (hits.length < INFIX_WHEN_FEWER_THAN) {
    const seen = new Set(hits.map((h) => h.id));
    hits = hits.concat(searchInside(index, query).filter((h) => !seen.has(h.id)));
  }
  if (!hits.length && terms.length > 1) {
    hits = toHits(index.search(query, { fuzzy, combineWith: 'OR' }));
  }
  return hits;
}

export function serialize(index: MiniSearch<IndexDoc>): string {
  return JSON.stringify(index);
}
