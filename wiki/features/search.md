---
type: feature
status: decided
sources: ["[[prd-2026-11-19]]", "[[architecture-2026-11-19]]"]
canonical: PRD.md#f2-search
updated: 2026-11-19
tags: []
---

# Search

Typesense-style keyword search that runs entirely on the device: typo tolerance, prefix on the last word, English stems, title > address > text ranking, and highlighted snippets. Meaning-based search is out of scope for v1.

- Requirements: PRD F2.1–F2.10. Target: 20 ms per query at 10,000 bookmarks (F2.9).
- Design: ARCHITECTURE 5.3 (query options, snippets) and 5.4 (index lifecycle).

## Related

- [[search-worker]]
- [[keyword-search-not-semantic]]
- [[unique-words-index]]
- [[can-search-hit-20ms]]
