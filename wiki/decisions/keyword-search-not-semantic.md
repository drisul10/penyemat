---
type: decision
status: decided
sources: ["[[prd-2026-11-19]]"]
canonical: PRD.md#f2-search
updated: 2026-11-19
tags: []
---

# Typo-tolerant keyword search, not semantic

**Decision:** Typesense-style keyword search on device. Meaning-based search is out of scope for v1.

**Options considered:** Typo-tolerant keyword; hybrid keyword + on-device embeddings; semantic only.

**Why:** Small (MiniSearch about 7 KB), instant, no model download.

**Cost:** "cheap flights" will not find "budget airfare".

Decided by the owner on 2026-11-19.

## Related

- [[search]]
- [[search-worker]]
