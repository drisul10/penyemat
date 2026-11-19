---
type: decision
status: proposed
sources: ["[[prd-2026-11-19]]", "[[architecture-2026-11-19]]"]
canonical: ARCHITECTURE.md#53-search
updated: 2026-11-19
tags: []
---

# Typos only for words without an exact match

**Decision:** the F2.3 typo budget (1 typo at 4+ letters, 2 at 8+) applies only to query words that have no exact match in the index, as Typesense does.

**Options considered:** fuzzy matching on every word; fuzzy matching only on unknown words.

**Why:** with fuzzy matching on every word, "lemmon zest" also matched "best". A title containing "Best" then ranked first because of the title boost.

**Cost:** one extra exact lookup per word of 4+ letters. The benchmark still meets F2.9.

Proposed by the build agent on 2026-11-19; waiting for the owner's confirmation.

## Related

- [[search]]
- [[keyword-search-not-semantic]]
- [[search-worker]]
