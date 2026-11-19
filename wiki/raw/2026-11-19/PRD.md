# Penyemat: product requirements (v1)

Status: draft, 2026-11-19, updated the same day with answers to Q1 to Q7. Decisions marked **Decided** come from the user's answers on that date. Items marked **Proposed** are suggestions waiting for confirmation. Items marked **Open** have no answer yet.

## 1. Summary

Penyemat is a bookmark manager that runs entirely inside a browser extension. People save a page in one click, sort it onto a shelf, and find it again later by any words they remember from the page. Search is fast and tolerant of typos, like Typesense, but runs on the device. One shelf can be locked with a passphrase and encrypted.

## 2. Users and job

- **Who:** general web users (DESIGN.md).
- **Main job:** find a saved link again later.
- **Why choose it:** full-text search of page content, not just titles.
- **Character:** quick, sharp, dependable.
- **Market:** no specific market, English UI.

## 3. Hard constraints (Decided)

| ID | Constraint | Source |
| --- | --- | --- |
| C1 | No database server and no network server. All data, indexing, search, and encryption run on the client. | User, 2026-11-19: "NO DB server, NO NETWORK server, everything is in client" |
| C2 | The library runs inside the extension as an extension page. There is no separate website. | User, 2026-11-19: "Inside the extension" |
| C3 | v1 supports Chromium browsers (Chrome, Edge, Brave, Arc, Opera) and Firefox. Safari follows after v1, once a Mac and an Apple developer account are available. | User, 2026-11-19: "Chromium + Firefox + Safari", then "Not yet, Safari after v1" |
| C4 | One library handles up to 10,000 bookmarks with full page text indexed, smoothly. | User, 2026-11-19: "Up to 10,000" |

Consequences of C1 that the product must accept:
- There is no sync between devices or browsers. Each browser profile has its own library.
- Uninstalling the extension or clearing its data deletes the library. Backup (F5) is the only protection.
- There are no accounts, no sign-in, and no telemetry. Nothing leaves the device except fetching a pasted link's page (user, 2026-11-19: "No accounts, sign-in, or telemetry").

## 4. Features

### F1. Save a page

| ID | Requirement | Acceptance check |
| --- | --- | --- |
| F1.1 | Clicking the toolbar button saves the current page at once: title, address, favicon, saved date, and the readable page text. | Popup shows "Saved" within 200 ms on a typical article (decided 2026-11-19). |
| F1.2 | The popup opens already saved and offers category chips. Picking one is optional. | Closing the popup without a pick keeps the save. |
| F1.3 | Saving the same address again creates no duplicate. The popup shows "Already saved" with the date and lets the user change the shelf. | Two saves of one address give one record. |
| F1.4 | The library has "Save a link" for pasted addresses. The extension fetches the page and extracts its text. | A pasted public page becomes searchable by its body text. |
| F1.5 | When the text can't be read (login wall, image, and all PDFs in v1), the save still succeeds and search covers its title and address only. The popup says so. | Decided 2026-11-19. Popup shows the unreadable notice. |
| F1.6 | Browser pages that can't be saved (settings, new tab, store pages) show "Penyemat can't save this kind of page". | No record is created. |
| F1.7 | Page text stored per bookmark is capped at the first 100 KB of extracted text (about 15,000 words). Search covers only the stored text. | Decided 2026-11-19. A 300 KB page stores 100 KB. |

### F2. Search

| ID | Requirement | Acceptance check |
| --- | --- | --- |
| F2.1 | Search covers title, address, and full page text of every unlocked bookmark. | A word that appears only in the body finds the page. |
| F2.2 | Results update as the user types, with no Enter needed. | Typing shows results without submit. |
| F2.3 | Typo tolerant, Typesense style. **Proposed defaults:** 1 typo allowed for words of 4+ letters, 2 typos for 8+ letters. | "lemmon zest" finds "lemon zest". |
| F2.4 | Prefix matching on the last word typed. | "sourd" finds "sourdough". |
| F2.5 | Word stems in English. | "recipe" finds "recipes". |
| F2.6 | Ranking: title matches above address matches above body matches; ties broken by newer saves first. | Title hit ranks above body-only hit. |
| F2.7 | Each result shows a snippet from the page text with the matched words highlighted. | Snippet contains the matched words. |
| F2.8 | Search runs fully on device, with no network request. | No network calls during search (devtools check). |
| F2.9 | Results appear within 20 ms per query at 10,000 bookmarks on a mid-range laptop. | Decided 2026-11-19. Benchmark on a 10,000-page test library. |
| F2.10 | Meaning-based search ("cheap flights" finds "budget airfare") is out of scope for v1. | Decided, user chose typo-tolerant keyword search. |

Implementation: MiniSearch in a Web Worker, index persisted in IndexedDB (ARCHITECTURE.md).

### F3. Categories and shelves

| ID | Requirement | Acceptance check |
| --- | --- | --- |
| F3.1 | A starter set ships: Read later, Recipes, Travel, Home. Users can rename, reorder, delete, and add categories. | Decided 2026-11-19. |
| F3.1a | An Unsorted shelf holds saves with no category. It is separate from the starter set, always last, and can't be renamed or deleted. | Decided 2026-11-19. |
| F3.2 | A category is optional at save and can be changed later. | Decided 2026-11-19. |
| F3.3 | Each link belongs to exactly one category. | Decided 2026-11-19. |
| F3.4 | The library shows categories as shelves of folded cards under the search field. | Matches design.html. |
| F3.5 | Deleting a link shows Undo for 10 seconds. Deleting a category asks for confirmation and moves its links to Unsorted; the dialog says how many move. | Decided 2026-11-19. |

### F4. Locked shelf

| ID | Requirement | Acceptance check |
| --- | --- | --- |
| F4.1 | There is one locked shelf. Before it is unlocked, the library shows its name and a lock, with no links and no count. | Decided 2026-11-19. |
| F4.2 | Contents are encrypted on device with a key derived from a passphrase. Title, address, page text, favicon, dates, and the search index for locked items are all encrypted. | Reading extension storage directly shows no readable locked data. |
| F4.3 | Web Crypto AES-GCM 256, with the key derived by Argon2id (WebAssembly) from the passphrase and a random salt. Parameters in ARCHITECTURE.md. | Decided 2026-11-19 ("Argon2id via WebAssembly"). |
| F4.4 | The key lives only in memory while the shelf is unlocked. It is never written to disk. | Key absent from storage after unlock (devtools check). |
| F4.5 | Locked items never appear in search while locked. Once unlocked, they join search results until the shelf locks again. | Search before and after unlock. |
| F4.6 | The shelf locks again when the last library tab closes, and after idle time the user sets in Settings: default 5 minutes, range 1 to 60. | Decided 2026-11-19. |
| F4.7 | The popup offers a "Locked" chip. Tapping it asks for the passphrase, then encrypts and saves the page straight into the locked shelf, with no unencrypted copy written first. | Decided 2026-11-19. |
| F4.8 | A forgotten passphrase cannot be recovered. Setup must say this plainly and require the user to confirm before the first item is locked. | Setup screen copy and confirm step. |
| F4.9 | Changing the passphrase re-encrypts the locked shelf. | Old passphrase stops working. |
| F4.10 | The passphrase is at least 8 characters. | Decided 2026-11-19. A 7-character passphrase is refused. |
| F4.11 | Wrong passphrase attempts have no limit and no delay. | Decided 2026-11-19. |

### F5. Backup

| ID | Requirement | Acceptance check |
| --- | --- | --- |
| F5.1 | Settings has Export, which writes one file with all bookmarks, categories, and page text. | Decided 2026-11-19. |
| F5.2 | The locked shelf stays encrypted inside the export file. | Export opened in a text editor shows no locked data. |
| F5.3 | Import reads that file into a library. | Export then import into a fresh install restores everything. |
| F5.4 | On import, an address already in the library keeps whichever copy was saved more recently. Import ends with a count, for example "Imported 120, updated 8, skipped 3". | Decided 2026-11-19. |
| F5.5 | **Proposed:** the library shows when the last export happened, so users know their backup's age. | |

## 5. Non-functional requirements

| ID | Requirement |
| --- | --- |
| N1 | Works with no network at all for search, browsing, organizing, locking, and export. Only F1.4 (pasted links) needs the network, to fetch the page. |
| N2 | Storage uses extension-origin IndexedDB, with persistent or unlimited storage permission where the browser offers it. |
| N3 | No analytics, telemetry, or third-party requests. Decided 2026-11-19. |
| N4 | Keyboard: "/" focuses search, arrow keys move between results, Enter opens one, Esc clears. |
| N5 | Text contrast meets WCAG 2.2 AA (the measured palette in DESIGN.md passes). |

## 6. Out of scope for v1

- Sync between devices or browsers (blocked by C1).
- Meaning-based search (F2.10).
- Mobile apps.
- Sharing or teams.
- Multiple locked shelves (F4.1).
- Safari (after v1, C3).

## 7. Risks

| ID | Risk | Mitigation |
| --- | --- | --- |
| K1 | Fetching pasted links (F1.4) needs broad host permissions, which store reviews question and users distrust. | Ask for the permission only when the user first pastes a link (optional permissions). |
| K2 | Safari can clear extension storage under pressure, and its Web Crypto and IndexedDB behave differently. | Test early. Remind Safari users to export. |
| K3 | A full-text index of 10,000 pages may load slowly on a cold start. | Load the index in a worker. Show shelves before search is ready. |
| K4 | A user locks links, forgets the passphrase, and loses them. | F4.8 warning and confirm. Proposed: offer an export right after setup. |
| K5 | Safari needs an Xcode wrapper app, a Mac, and an Apple developer account. | Moved after v1 (C3). |
| K6 | An 8-character passphrase with no attempt limit can be guessed offline by anyone who copies the encrypted data or an export file. Argon2id runs at the OWASP minimum (19 MiB, 2 passes), chosen so libraries also unlock on phones. | Setup suggests a longer passphrase without requiring one. Parameters can be raised in a later version on passphrase change. |

## 8. Open questions

None. Answered 2026-11-19: Q1 idle time (F4.6), Q2 passphrase (F4.10, F4.11), Q3 Safari (C3), Q4 text cap (F1.7), Q5 import (F5.4), Q6 no accounts or telemetry (section 3, N3), Q7 categories and Undo (F3.1, F3.1a, F3.5), Q8 unreadable pages (F1.5).

## 9. Design follow-ups

- design.html shows "Get the browser extension" in the first-use state. Under C2 the library is the extension, so that link goes.
- The locked shelf (closed, unlock prompt, setup with the passphrase warning, wrong passphrase, locked chip in the popup) is not designed yet.
- Settings (Export, Import, last export date, change passphrase) is not designed yet.
