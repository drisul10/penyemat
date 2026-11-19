---
type: feature
status: decided
sources: ["[[prd-2026-11-19]]", "[[architecture-2026-11-19]]"]
canonical: PRD.md#f4-locked-shelf
updated: 2026-11-19
tags: [security]
---

# Locked shelf

One shelf, shown closed with its name and a lock, whose contents and search index are encrypted on device. Unlock once per session across tabs; it relocks when the last library tab closes or after the idle time set in Settings. A separate "Save to Locked" command (right-click menu, optional shortcut) saves pages straight into it, encrypted only. The popup's Locked chip moves a page already saved, with a warning that traces of the plain copy may remain. A lost passphrase cannot be recovered.

- Requirements: PRD F4.1–F4.11. Crypto and flows: ARCHITECTURE 5.5.

## Related

- [[encrypted-locked-shelf]]
- [[key-sharing-and-relock]]
- [[library-page]]
- [[popup]]
