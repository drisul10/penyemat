---
type: component
status: active
sources: ["[[architecture-2026-11-19]]"]
canonical: ARCHITECTURE.md#53-search
updated: 2026-11-19
tags: []
---

# Search worker

Web Worker inside the library page. Loads the gzipped MiniSearch snapshot, syncs changes since its watermark, answers queries, builds snippets, and runs Argon2id so unlocking never blocks the UI. Builds a second index for the locked shelf in memory on unlock and drops it on relock; that index is never stored.

- Code: `src/workers/search.worker.ts`. Design: ARCHITECTURE 5.3–5.5.

## Related

- [[search]]
- [[unique-words-index]]
- [[can-search-hit-20ms]]
- [[encrypted-locked-shelf]]
- [[index-sync-by-watermark]]
- [[typos-only-without-exact-match]]
