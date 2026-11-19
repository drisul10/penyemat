---
type: concept
status: decided
sources: ["[[architecture-2026-11-19]]"]
canonical: ARCHITECTURE.md#4-data-model-dexie
updated: 2026-11-19
tags: []
---

# URL normalization

Two addresses are the same page when they match after: lowercasing the host, dropping the `#fragment`, and dropping `utm_*`, `fbclid`, and `gclid`. The path and other parameters are kept. Used for duplicate detection on save (F1.3) and import (F5.4).

- Code: `src/lib/url.ts`.

## Related

- [[save-a-page]]
- [[backup]]
- [[dexie-store]]
