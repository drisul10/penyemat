---
type: component
status: proposed
sources: ["[[architecture-2026-11-19]]"]
canonical: ARCHITECTURE.md#4-data-model-dexie
updated: 2026-11-19
tags: []
---

# Dexie store

IndexedDB through Dexie. Tables: `bookmarks`, `categories`, `lockedRecords`, `lockMeta`, `indexSnapshots`, `settings`. Schema changes need a migration and the owner's approval (AGENTS.md).

- Code: `src/lib/db/`. Schema: ARCHITECTURE section 4.

## Related

- [[url-normalization]]
- [[encrypted-locked-shelf]]
- [[backup]]
