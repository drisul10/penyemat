---
type: question
status: decided
sources: ["[[prd-2026-11-19]]", "[[architecture-2026-11-19]]"]
canonical: ARCHITECTURE.md#9-risks
updated: 2026-11-19
tags: []
---

# Can search hit 20 ms at 10,000 pages?

PRD F2.9 sets 20 ms per query. Two-typo fuzzy matching over a large vocabulary may exceed it (ARCHITECTURE T2).

- **How to answer:** `pnpm bench` on a generated 10,000-page library in week 1.
- **If it fails:** shard the index by category, cap distinct words per page, or limit fuzzy expansion per term.

- **Answer (2026-11-19):** yes on a generated library. `pnpm bench` at 10,000 pages and 138k terms gives query means of 0.7 to 14.6 ms. The snapshot is 28 MB gzipped and loads in about 2 to 3 s. A full rebuild takes 22 to 25 s. Real libraries are not measured yet (ARCHITECTURE T2).

## Related

- [[search]]
- [[search-worker]]
- [[unique-words-index]]
