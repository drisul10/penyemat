---
type: decision
status: decided
sources: ["[[architecture-2026-11-19]]"]
canonical: ARCHITECTURE.md#53-search
updated: 2026-11-19
tags: []
---

# Index unique words per page

**Decision:** The body field indexes each distinct word once per page; title and address are indexed in full.

**Options considered:** Unique words; full stored text; first 20 KB.

**Why:** Keeps any-word findability while shrinking the index several times at 10,000 pages.

**Cost:** Body ranking counts presence, not frequency.

Decided by the owner on 2026-11-19.

## Related

- [[search]]
- [[search-worker]]
- [[can-search-hit-20ms]]
