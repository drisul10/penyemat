---
type: decision
status: decided
sources: ["[[prd-2026-11-19]]"]
canonical: PRD.md#3-hard-constraints-decided
updated: 2026-11-19
tags: []
---

# Library runs inside the extension

**Decision:** The library is an extension page, not a website.

**Options considered:** Inside the extension; static website plus extension; installable web app only.

**Why:** Only an extension can fetch other sites' pages without a server, which full-text capture needs.

**Cost:** No library without the extension installed.

Decided by the owner on 2026-11-19.

## Related

- [[no-server]]
- [[library-page]]
- [[save-a-page]]
