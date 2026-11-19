---
type: decision
status: proposed
sources: ["[[architecture-2026-11-19]]"]
canonical: ARCHITECTURE.md#54-index-lifecycle
updated: 2026-11-19
tags: []
---

# Index sync by watermark

**Decision:** the search worker picks up changes by `updatedAt` and `tombstones.removedAt` newer than its snapshot's watermark, instead of marking rows `indexed`.

**Options considered:** per-row `indexState` flags (the first draft of ARCHITECTURE 5.4); a watermark on timestamps.

**Why:** with flags, two open library tabs race. One tab marks a row indexed and the other never sees it. With a watermark, every worker reads every change. Page text moved to its own `texts` table so shelves load without it.

**Cost:** two more tables (`texts`, `tombstones`). Tombstones are purged after 30 days.

Proposed by the build agent on 2026-11-19; waiting for the owner's confirmation.

## Related

- [[search-worker]]
- [[dexie-store]]
