// Generated 10,000-page test library (PRD F2.9, ARCHITECTURE 8). Invented words only.

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SYLLABLES =
  'ka lo mi re tan sol ver pin dor qua bel fen gri hul jas kor lum nev obi pra sut tiv urs wal yen zor ch th st br pl gr ent ing ion er al ous'.split(
    ' ',
  );

export function makeVocabulary(size: number, seed = 7): string[] {
  const random = rng(seed);
  const words = new Set<string>();
  while (words.size < size) {
    const parts = 2 + Math.floor(random() * 3);
    let word = '';
    for (let i = 0; i < parts; i++) word += SYLLABLES[Math.floor(random() * SYLLABLES.length)];
    words.add(word);
  }
  return [...words];
}

export interface BenchPage {
  id: string;
  title: string;
  url: string;
  savedAt: number;
  text: string;
}

/** Zipf-like word choice: common words repeat across pages, the long tail stays rare. */
export function makeLibrary(
  count = 10_000,
  vocabSize = 150_000,
  wordsPerPage = 1_200,
  seed = 11,
): {
  pages: BenchPage[];
  vocabulary: string[];
} {
  const vocabulary = makeVocabulary(vocabSize);
  const random = rng(seed);
  const pick = () => vocabulary[Math.floor(vocabSize * random() ** 3)] ?? 'x';
  const pages: BenchPage[] = [];
  for (let i = 0; i < count; i++) {
    const body: string[] = [];
    for (let w = 0; w < wordsPerPage; w++) body.push(pick());
    pages.push({
      id: `p${i}`,
      title: `${pick()} ${pick()} ${pick()} ${pick()}`,
      url: `https://site${i % 300}.example.com/${pick()}/${pick()}`,
      savedAt: i,
      text: body.join(' '),
    });
  }
  return { pages, vocabulary };
}
