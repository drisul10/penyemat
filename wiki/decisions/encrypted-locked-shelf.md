---
type: decision
status: decided
sources: ["[[prd-2026-11-19]]", "[[architecture-2026-11-19]]"]
canonical: ARCHITECTURE.md#55-locked-shelf-f4
updated: 2026-11-19
tags: [security]
---

# Locked shelf is encrypted, Argon2id at 19 MiB

**Decision:** One locked shelf encrypted with AES-GCM 256. Key from Argon2id (19 MiB, 2 passes, OWASP minimum). Passphrase at least 8 characters, no attempt limit.

**Options considered:** Hide behind a PIN; encrypt with a passphrase; device unlock. Argon2id at 64, 46, or 19 MiB; PBKDF2.

**Why:** Real privacy with no server; 19 MiB so one library also unlocks on phones (Firefox for Android now, Safari on iOS later).

**Cost:** A lost passphrase loses the shelf. An 8-character passphrase with no attempt limit at 19 MiB is cheap to guess offline from a copied library or export (PRD K6, ARCHITECTURE T4).

Decided by the owner on 2026-11-19.

## Related

- [[locked-shelf]]
- [[key-sharing-and-relock]]
- [[search-worker]]
