---
type: feature
status: decided
sources: ["[[prd-2026-11-19]]", "[[architecture-2026-11-19]]"]
canonical: PRD.md#f1-save-a-page
updated: 2026-11-19
tags: []
---

# Save a page

One toolbar click saves the current page with its readable text. The popup opens already saved and offers optional category chips. Pasted links are fetched from the library page. Duplicates are caught by URL normalization; unreadable pages and PDFs save with title and address only.

- Requirements: PRD F1.1–F1.7. Text cap: first 100 KB (F1.7). Target: "Saved" within 200 ms (F1.1).
- Flow: ARCHITECTURE 5.1 (toolbar) and 5.2 (pasted link).

## Related

- [[extractor]]
- [[background-worker]]
- [[popup]]
- [[url-normalization]]
- [[shelves]]
- [[locked-shelf]]
