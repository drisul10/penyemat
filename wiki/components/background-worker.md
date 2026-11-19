---
type: component
status: active
sources: ["[[architecture-2026-11-19]]"]
canonical: ARCHITECTURE.md#2-components
updated: 2026-11-19
tags: []
---

# Background service worker

Stateless MV3 service worker. Handles the toolbar click, injects the extractor through `activeTab` + `scripting.executeScript`, applies the 100 KB cap, and writes the bookmark to Dexie as pending. Holds no index or key because MV3 stops it after about 30 s idle.

- Code: `src/entrypoints/background.ts`. Flow: ARCHITECTURE 5.1.

## Related

- [[extractor]]
- [[dexie-store]]
- [[popup]]
- [[save-a-page]]
