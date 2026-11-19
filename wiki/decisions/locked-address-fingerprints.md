---
type: decision
status: decided
sources: ["[[prd-2026-11-19]]"]
canonical: PRD.md#f4-locked-shelf
updated: 2026-11-19
tags: []
---

# Locked address fingerprints

**Decision:** each locked record stores a salted SHA-256 fingerprint of its address, so the toolbar button can tell a page is already locked without the key, and writes nothing.

**Options considered:** fingerprints; asking an unlocked library tab and prompting when none is open; always asking where to save once a locked shelf exists.

**Why:** without it, clicking the button on a locked page saved a second, unencrypted copy, which defeated the lock.

**Cost:** anyone with a copy of the data can test a guessed address (PRD risk K7). Dexie schema v2 adds the `fingerprint` index; old records gain fingerprints on the next unlock.

Decided by the owner on 2026-11-19: "Store address fingerprints (Recommended)".

## Related

- [[locked-shelf]]
- [[encrypted-locked-shelf]]
- [[dexie-store]]
