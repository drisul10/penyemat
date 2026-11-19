---
type: decision
status: decided
sources: ["[[prd-2026-11-19]]", "[[design-boards-2026-11-19]]"]
canonical: PRD.md#f4-locked-shelf
updated: 2026-11-19
tags: [security]
---

# Save to Locked is a separate command

**Decision:** A "Save to Locked" command in the right-click menu of the toolbar button and of pages (plus an optional shortcut the user sets in the browser) saves pages encrypted only. The popup's Locked chip moves a page that was already saved, and warns that traces of the plain copy may remain.

**Options considered:** a separate command; a popup that holds the save for a moment; accepting a brief unencrypted copy.

**Why:** One-click save writes the page at once (PRD F1.1), and a locked page must never be stored unencrypted (F4.7). Only a separate path satisfies both.

**Cost:** One more command to learn. Needs the `contextMenus` permission. Pages moved from the popup chip may leave traces in IndexedDB.

Decided by the owner on 2026-11-19.

## Related

- [[locked-shelf]]
- [[encrypted-locked-shelf]]
- [[popup]]
- [[background-worker]]
