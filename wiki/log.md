# Log

Append-only. One heading per entry: `## [YYYY-MM-DD] ingest|query|lint | title`.

## [2026-11-19] ingest | Seed from project docs
- Snapshotted PRD.md, DESIGN.md, ARCHITECTURE.md, design.html, directions.html, and alternatives.html into `raw/2026-11-19/`.
- Created 4 source pages, 5 features, 6 components, 9 decisions, 3 concepts, and 2 open questions.
- Built index.md and dashboard.md.

## [2026-11-19] ingest | Starter categories reduced to Read later and Unsorted
- Source: the owner's instruction in chat (no document, so no raw snapshot). Canonical docs updated: PRD F3.1 and F3.1a, DESIGN.md Business rules and Corrections, design.html first-use state.
- Pages touched: [[shelves]].

## [2026-11-19] ingest | design.html matched to the docs; Save to Locked decision
- Source: owner's request to align the HTML boards, plus the owner's answer "Separate 'Save to Locked' command" (no document, so no raw snapshot).
- design.html: added sections 6 (locked shelf) and 7 (settings and backup), a Settings entry in the library header, the closed locked shelf, a fixed Unsorted, Undo at 10 s; removed stale "not decided" labels and the "Get the browser extension" link.
- Canonical docs: PRD F4.7, DESIGN.md Business rules, ARCHITECTURE permissions and 5.5.
- Pages touched: [[locked-shelf]], [[design-boards-2026-11-19]], new [[save-to-locked-command]].

## [2026-11-19] ingest | v1 build
- Source: the code built in this change (no document, so no raw snapshot).
- ARCHITECTURE.md updated (sections 4, 5.3, 5.4, 5.5, 6, 8, T2): `texts` and `tombstones` tables, watermark index sync, locked index kept in memory only, the typo rule, the e2e build, and the benchmark result.
- Pages touched: all six components (now active), [[can-search-hit-20ms]] and [[firefox-e2e-runner]] (answered), new [[index-sync-by-watermark]] and [[typos-only-without-exact-match]] (proposed).

## [2026-11-19] ingest | Search worker loads as an extension file
- Under `pnpm dev`, the worker URL pointed at the dev server (http://localhost:3000) and Chrome killed the library tab (RESULT_CODE_KILLED_BAD_MESSAGE). The worker is now built as `/search-worker.js` through `src/entrypoints/search-worker.ts`.
- ARCHITECTURE section 6 updated. Pages touched: none besides this log; [[search-worker]] behavior is unchanged.

## [2026-11-19] ingest | Search matches inside longer words
- Source: the owner's answer in chat, "I want like Typesense that can smartly word!" (no document, so no raw snapshot), after "nikah" missed a page titled "Menikah…".
- PRD F2.11 added (Decided). ARCHITECTURE 5.3 updated. The benchmark still meets F2.9 (query means 1.1 to 12.9 ms, inside-word queries 7.5 ms).
- Pages touched: [[search]].

## [2026-11-19] ingest | Move to Locked in the library card menu
- Source: the owner's answer in chat, "Add Move to Locked (Recommended)" (no document, so no raw snapshot), after asking why locked links still showed. Unsorted links were never on the locked shelf, and the library had no way to put them there.
- PRD F4.7, DESIGN.md Business rules, and ARCHITECTURE 5.5 updated. The card ⋯ menu gains "Move to Locked": confirm when the shelf is open, passphrase when it is locked (the shelf stays locked).
- Pages touched: [[locked-shelf]].

## [2026-11-19] ingest | Save a link into Locked; no plain duplicates of locked pages
- Source: owner messages in chat (no document, so no raw snapshot): "Also here, no option save to lock", and a report that the toolbar button duplicated a locked page as Unsorted; owner chose "Store address fingerprints (Recommended)".
- PRD F4.12, F4.13, risk K7 added. DESIGN.md Business rules, ARCHITECTURE sections 4, 5.1, 5.2 updated. Dexie schema v2 (`lockedRecords.fingerprint` index, `lockMeta.fingerprintSalt`).
- Pages touched: [[locked-shelf]], new [[locked-address-fingerprints]].

## [2026-11-19] ingest | Move to from locked cards; menu-style picker
- Source: owner message in chat, "On locked, it should also option 'MOVE TO'", and a request that the Lock after dropdown look like the ⋯ menus (no document, so no raw snapshot).
- PRD F4.14 added. ARCHITECTURE 5.5 and DESIGN.md Business rules updated. Settings' native select replaced by `src/components/Select.svelte` (listbox pattern).
- Pages touched: [[locked-shelf]].

## [2026-11-19] ingest | Drag a card to move it
- Source: owner's "YESS" to drag-to-move in chat, and a report that empty-category drop outlines overlapped (no document, so no raw snapshot).
- PRD F3.6 added, DESIGN.md Business rules updated. Pointer events for mouse; touch starts on a long press and follows touch events, because Chrome cancels the pointer once a finger moves.
- Pages touched: [[shelves]].

## [2026-11-19] ingest | Move up and down follow the shelves on screen
- Source: owner's report in chat: a top shelf still offered "Move up" (no document, so no raw snapshot).
- Cause: positions counted empty categories, which are listed apart at the bottom. Shelves now reorder among shelves, and empty categories among themselves (`swapCategories`).
- Pages touched: none besides this log; [[shelves]] behavior otherwise unchanged.

## [2026-11-19] ingest | Categories in search
- Source: owner's choice in chat: "Shelf match on top (Recommended), Filter results by category" (no document, so no raw snapshot). Indexing category names as search words was offered and not chosen.
- PRD F2.12 and F2.13 added. Done in the library page only (`shelfMatches`, `facets`, `pageRows` in state.svelte.ts); the search index is unchanged.
- Pages touched: [[search]].

## [2026-11-19] ingest | Autosave
- Source: owner messages in chat: "we also should add option \"Autosave\", default turned off", then "Add both (Recommended)", "After changes, at most hourly (Recommended)", "One file and backup on browser memory" (no document, so no raw snapshot).
- PRD F5.6, ARCHITECTURE sections 3 (permissions `downloads`, `alarms`), 4 (settings fields, `backups` table, Dexie v3), 5.7, and DESIGN.md Business rules updated.
- Not built: a custom folder outside Downloads (browsers allow silent writes only inside Downloads).
- Pages touched: [[backup]].

## [2026-11-19] ingest | Autosave into a chosen folder
- Source: owner message in chat, "can we choose location instead of \"inside downloads?\"" (no document, so no raw snapshot).
- Chromium: folder picker (File System Access API); falls back to Downloads while the browser needs the user's OK again. Firefox: Downloads subfolder only. PRD F5.6 and ARCHITECTURE 5.7 updated.
- Pages touched: [[backup]].
