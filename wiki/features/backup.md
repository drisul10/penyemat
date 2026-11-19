---
type: feature
status: decided
sources: ["[[prd-2026-11-19]]", "[[architecture-2026-11-19]]"]
canonical: PRD.md#f5-backup
updated: 2026-11-19
tags: []
---

# Backup (export and import)

With no server, export to a file is the only protection against losing the library. The export keeps the locked shelf encrypted. Import keeps the newer copy of duplicate addresses and reports counts.

- Requirements: PRD F5.1–F5.5. Flow and the locked-records cases: ARCHITECTURE 5.6.

- Autosave (PRD F5.6, ARCHITECTURE 5.7): off by default; hourly when something changed, one file in Downloads, last 7 copies restorable in the browser.

## Related

- [[no-server]]
- [[locked-shelf]]
- [[dexie-store]]
- [[url-normalization]]
