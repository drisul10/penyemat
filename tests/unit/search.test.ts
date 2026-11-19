import { describe, expect, it } from 'vitest';
import {
  createIndex,
  loadIndex,
  rank,
  remove,
  searchIndex,
  serialize,
  toIndexDoc,
  upsert,
} from '../../src/lib/search/engine';
import { makeSnippet } from '../../src/lib/search/snippet';
import { uniqueBodyTerms } from '../../src/lib/search/tokenize';

const pages = [
  {
    id: 'pasta',
    title: 'Lemon ricotta pasta in 20 minutes',
    url: 'https://recipes.example.com/lemon-ricotta-pasta',
    savedAt: 5,
    text: 'Boil the pasta. Finish with lemon zest and a spoon of pasta water so the sauce clings to every piece.',
  },
  {
    id: 'bread',
    title: "Beginner's guide to sourdough starter",
    url: 'https://bread.example.com/starter',
    savedAt: 3,
    text: 'Feed the starter daily. A loaf with lemon zest and poppy seeds works once the starter is bubbling reliably.',
  },
  {
    id: 'soup',
    title: 'Weeknight tomato soup',
    url: 'https://recipes.example.com/tomato-soup',
    savedAt: 4,
    text: 'Collected recipes for quick soups. Roast the tomatoes first.',
  },
  {
    id: 'shoes',
    title: 'Choosing running shoes for flat feet',
    url: 'https://health.example.com/shoes',
    savedAt: 1,
    text: 'Stability shoes help. Some runners like a lemon after a long run.',
  },
];

function build() {
  const index = createIndex();
  for (const p of pages) upsert(index, toIndexDoc(p, p.text));
  return index;
}

const ids = (q: string, index = build()) => rank(searchIndex(index, q)).map((h) => h.id);

describe('search (F2)', () => {
  it('finds a page by a word that appears only in the body (F2.1)', () => {
    expect(ids('poppy')).toEqual(['bread']);
  });
  it('tolerates a typo: "lemmon zest" finds "lemon zest" (F2.3)', () => {
    expect(ids('lemmon zest')).toEqual(expect.arrayContaining(['pasta', 'bread']));
  });
  it('allows no typo in short words', () => {
    expect(ids('sop')).not.toContain('soup');
  });
  it('matches a prefix on the last word: "sourd" finds "sourdough" (F2.4)', () => {
    expect(ids('sourd')).toEqual(['bread']);
  });
  it('stems English: "recipe" finds "recipes" (F2.5)', () => {
    expect(ids('recipe')).toContain('soup');
  });
  it('ranks a title hit above a body-only hit (F2.6)', () => {
    expect(ids('lemon')[0]).toBe('pasta');
  });
  it('breaks ties with newer saves first (F2.6)', () => {
    const hits = rank([
      { id: 'old', score: 1, savedAt: 1, tier: 0, terms: [] },
      { id: 'new', score: 1, savedAt: 9, tier: 0, terms: [] },
    ]);
    expect(hits.map((h) => h.id)).toEqual(['new', 'old']);
  });
  it('falls back to any-word matches when all words find nothing', () => {
    expect(ids('poppy spaceship')).toEqual(['bread']);
  });
  it('drops removed pages and survives a snapshot round trip', () => {
    const index = build();
    remove(index, 'bread');
    const loaded = loadIndex(serialize(index));
    expect(ids('sourdough', loaded)).toEqual([]);
    expect(ids('tomato', loaded)).toEqual(['soup']);
  });
  it('indexes unique body words only, without stop words', () => {
    const terms = uniqueBodyTerms('The lemons and the lemon and THE Lemon');
    expect(terms).toEqual(['lemon']);
  });
});

describe('snippets (F2.7)', () => {
  it('contains and highlights the matched words', () => {
    const index = build();
    const hit = rank(searchIndex(index, 'lemmon zest')).find((h) => h.id === 'bread');
    const snippet = makeSnippet(pages[1]?.text ?? '', hit?.terms ?? []);
    expect(snippet).not.toBeNull();
    const marked = snippet?.ranges.map(([s, e]) => snippet.text.slice(s, e).toLowerCase());
    expect(marked).toEqual(['lemon', 'zest']);
  });
  it('centres on a match deep in long text and cuts on word boundaries', () => {
    const text = `${'filler words here '.repeat(100)}the secret ingredient is sumac ${'tail words '.repeat(50)}`;
    const snippet = makeSnippet(text, ['sumac']);
    expect(snippet?.text.startsWith('…')).toBe(true);
    expect(snippet?.text.endsWith('…')).toBe(true);
    expect(snippet?.text).toContain('sumac');
    expect(snippet?.text.length).toBeLessThanOrEqual(165);
  });
});

describe('typos only where needed (F2.3, Typesense style)', () => {
  it('does not fuzz a word that matches exactly', () => {
    const index = createIndex();
    upsert(
      index,
      toIndexDoc({ id: 'zest', title: 'Lemon zest', url: 'https://a.example.com/', savedAt: 1 }, 'lemon zest'),
    );
    upsert(
      index,
      toIndexDoc({ id: 'best', title: 'Best lemon tips', url: 'https://b.example.com/', savedAt: 2 }, 'lemon'),
    );
    expect(rank(searchIndex(index, 'lemmon zest')).map((h) => h.id)).toEqual(['zest']);
  });
});

describe('matches inside words, like Typesense infix search', () => {
  const build2 = () => {
    const index = createIndex();
    const add = (id: string, title: string, text: string, savedAt: number) =>
      upsert(index, toIndexDoc({ id, title, url: `https://${id}.example.com/`, savedAt }, text));
    add('menikah', 'Menikah setelah itu punya anak', 'fase kehidupan yang baru', 1);
    add('nikah', 'Biaya nikah di kota', 'daftar biaya', 2);
    add('other', 'Weeknight tomato soup', 'roast the tomatoes', 3);
    return index;
  };

  it('"nikah" finds "Menikah", after the page with the whole word', () => {
    const hits = rank(searchIndex(build2(), 'nikah'));
    expect(hits.map((h) => h.id)).toEqual(['nikah', 'menikah']);
    expect(hits[1]?.terms).toContain('menikah');
  });

  it('survives a snapshot round trip', () => {
    const loaded = loadIndex(serialize(build2()));
    expect(rank(searchIndex(loaded, 'nikah')).map((h) => h.id)).toContain('menikah');
  });

  it('needs every typed word to match, whole or inside', () => {
    expect(rank(searchIndex(build2(), 'nikah anak')).map((h) => h.id)).toEqual(['menikah']);
  });

  it('highlights the longer word in the snippet', () => {
    const hit = rank(searchIndex(build2(), 'nikah')).find((h) => h.id === 'menikah');
    const snippet = makeSnippet('Menikah setelah itu punya anak', hit?.terms ?? []);
    expect(snippet?.ranges.map(([a, b]) => snippet.text.slice(a, b))).toEqual(['Menikah']);
  });
});
