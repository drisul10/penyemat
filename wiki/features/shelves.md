---
type: feature
status: decided
sources: ["[[prd-2026-11-19]]", "[[design-md-2026-11-19]]"]
canonical: PRD.md#f3-categories-and-shelves
updated: 2026-11-19
tags: []
---

# Shelves (categories)

Saved links sit on shelves, one category per link. The starter set is only Read later and Unsorted; users add their own categories. Unsorted is always last, can't be renamed or deleted, and holds saves with no category. Deleting a category moves its links to Unsorted; deleting a link offers Undo for 10 seconds.

- Requirements: PRD F3.1–F3.5. Rules: DESIGN.md Business rules.

- Drag a card onto another shelf, an empty category, or the locked shelf to move it (PRD F3.6). Code: `src/entrypoints/library/drag.svelte.ts`.

## Related

- [[library-layout]]
- [[folded-corner-signature]]
- [[save-a-page]]
