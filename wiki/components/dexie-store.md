---
type: component
status: active
sources: ["[[architecture-2026-11-19]]"]
canonical: ARCHITECTURE.md#4-data-model-dexie
updated: 2026-11-19
tags: []
---

# Dexie store

IndexedDB through Dexie. Tables: `bookmarks`, `texts`, `tombstones`, `categories`, `lockedRecords`, `lockMeta`, `indexSnapshots`, `settings`. Page text lives in `texts` so shelves load without it; deletes leave a `tombstones` row with no URL or title (ARCHITECTURE section 4). Schema changes need a migration and the owner's approval (AGENTS.md).

- Code: `src/lib/db/`. Schema: ARCHITECTURE section 4.

## Related

- [[url-normalization]]
- [[encrypted-locked-shelf]]
- [[backup]]
- [[index-sync-by-watermark]]
