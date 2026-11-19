---
type: component
status: proposed
sources: ["[[architecture-2026-11-19]]"]
canonical: ARCHITECTURE.md#2-components
updated: 2026-11-19
tags: []
---

# Library page

Svelte extension page: search field, shelves, organize actions, settings, export and import, and paste-a-link (it parses fetched pages with `DOMParser`, which the service worker lacks). Owns the search worker and the lock timers.

- Code: `src/entrypoints/library/`. Screens: design.html sections 1–4.

## Related

- [[search-worker]]
- [[library-layout]]
- [[key-sharing-and-relock]]
- [[backup]]
