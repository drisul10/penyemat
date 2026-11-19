---
type: decision
status: decided
sources: ["[[prd-2026-11-19]]"]
canonical: PRD.md#3-hard-constraints-decided
updated: 2026-11-19
tags: []
---

# No server of any kind

**Decision:** No database server and no network server. Data, indexing, search, and encryption all run in the client.

**Options considered:** Stated directly by the owner, with no alternatives offered.

**Why:** Owner's requirement: "NO DB server, NO NETWORK server, everything is in client".

**Cost:** No sync between devices, no accounts, and uninstalling loses data unless exported.

Decided by the owner on 2026-11-19.

## Related

- [[library-inside-extension]]
- [[backup]]
- [[tech-stack]]
