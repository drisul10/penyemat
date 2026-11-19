import { expect, it } from 'vitest';
import { gunzip, gzip } from '../../src/lib/bytes';
import { createIndex, loadIndex, rank, searchIndex, serialize, toIndexDoc, upsert } from '../../src/lib/search/engine';
import { makeLibrary } from './library';

// F2.9: under 20 ms per query at 10,000 bookmarks. Run with `pnpm bench`.

const TARGET_MS = 20;

function time(fn: () => void, runs: number): { mean: number; p95: number } {
  for (let i = 0; i < 5; i++) fn();
  const samples: number[] = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    fn();
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  return {
    mean: samples.reduce((s, v) => s + v, 0) / runs,
    p95: samples[Math.floor(runs * 0.95)] ?? 0,
  };
}

it('searches a 10,000-page library within 20 ms per query', async () => {
  const { pages, vocabulary } = makeLibrary();
  let start = performance.now();
  const index = createIndex();
  for (const page of pages) upsert(index, toIndexDoc(page, page.text));
  const buildMs = performance.now() - start;

  const json = serialize(index);
  const snapshot = await gzip(json);
  start = performance.now();
  const loaded = loadIndex(await gunzip(snapshot));
  const loadMs = performance.now() - start;

  const common = vocabulary.slice(0, 50);
  const rare = vocabulary.slice(5_000, 5_050);
  const typo = (w: string) => (w.length > 4 ? `${w.slice(0, 2)}${w[3]}${w[2]}${w.slice(4)}` : w);
  let n = 0;
  const next = (list: string[]) => list[n++ % list.length] ?? '';
  const cases: Record<string, () => void> = {
    'one common word': () => rank(searchIndex(loaded, next(common))),
    'two words, last a prefix': () => rank(searchIndex(loaded, `${next(common)} ${next(rare).slice(0, 4)}`)),
    'one word with a typo': () => rank(searchIndex(loaded, typo(next(rare)))),
    'two words with typos': () => rank(searchIndex(loaded, `${typo(next(rare))} ${typo(next(common))}`)),
    // A rare word without its first two letters matches only inside longer words.
    'inside a longer word': () => rank(searchIndex(loaded, next(rare).slice(2))),
  };

  console.log(
    `library: ${pages.length} pages, ${index.termCount} terms | build ${buildMs.toFixed(0)} ms | ` +
      `snapshot ${(json.length / 1e6).toFixed(1)} MB json, ${(snapshot.length / 1e6).toFixed(1)} MB gzip | ` +
      `load ${loadMs.toFixed(0)} ms`,
  );
  const means: number[] = [];
  for (const [name, fn] of Object.entries(cases)) {
    const { mean, p95 } = time(fn, 100);
    means.push(mean);
    console.log(`${name.padEnd(28)} mean ${mean.toFixed(2)} ms  p95 ${p95.toFixed(2)} ms`);
  }
  for (const mean of means) expect(mean).toBeLessThan(TARGET_MS);
}, 600_000);
