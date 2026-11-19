---
type: concept
status: decided
sources: ["[[architecture-2026-11-19]]"]
canonical: ARCHITECTURE.md#55-locked-shelf-f4
updated: 2026-11-19
tags: [security]
---

# Key sharing and relock

The user unlocks once and every open library tab can use the shelf: an unlocked tab answers `BroadcastChannel('penyemat-lock')` requests from new tabs. Each tab runs an idle timer from Settings (default 5 minutes, range 1–60). On timeout it broadcasts `lock` and every tab drops the key and the decrypted data. When the last tab closes, the key is gone.

- Accepted cost: the key sits in every open library tab's memory (ARCHITECTURE T6).

## Related

- [[locked-shelf]]
- [[encrypted-locked-shelf]]
- [[library-page]]
