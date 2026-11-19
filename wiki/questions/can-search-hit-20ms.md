---
type: question
status: open
sources: ["[[prd-2026-11-19]]", "[[architecture-2026-11-19]]"]
canonical: ARCHITECTURE.md#9-risks
updated: 2026-11-19
tags: []
---

# Can search hit 20 ms at 10,000 pages?

PRD F2.9 sets 20 ms per query. Two-typo fuzzy matching over a large vocabulary may exceed it (ARCHITECTURE T2).

- **How to answer:** `pnpm bench` on a generated 10,000-page library in week 1.
- **If it fails:** shard the index by category, cap distinct words per page, or limit fuzzy expansion per term.

## Related

- [[search]]
- [[search-worker]]
- [[unique-words-index]]
