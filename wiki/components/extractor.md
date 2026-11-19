---
type: component
status: proposed
sources: ["[[architecture-2026-11-19]]"]
canonical: ARCHITECTURE.md#51-save-from-the-toolbar-f11f16
updated: 2026-11-19
tags: []
---

# Extractor

Mozilla Readability run inside the page on a toolbar click, with a fallback to visible text. Applies the 100 KB cap and flags unsavable pages (browser pages, store pages) and unreadable ones (login walls, images, all PDFs in v1).

- Code: `src/lib/extract/`. Flow: ARCHITECTURE 5.1.

## Related

- [[save-a-page]]
- [[background-worker]]
