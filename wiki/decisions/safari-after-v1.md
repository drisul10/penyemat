---
type: decision
status: decided
sources: ["[[prd-2026-11-19]]"]
canonical: PRD.md#3-hard-constraints-decided
updated: 2026-11-19
tags: []
---

# Safari after v1

**Decision:** v1 ships for Chromium and Firefox. Safari follows once a Mac and an Apple developer account are available.

**Options considered:** Ship Safari in v1; build Safari locally only; ship after v1.

**Why:** The Safari build needs an Xcode wrapper and a paid developer account that isn't available yet.

**Cost:** Safari users wait; Argon2id parameters were still chosen to fit iOS later.

Decided by the owner on 2026-11-19.

## Related

- [[tech-stack]]
- [[encrypted-locked-shelf]]
