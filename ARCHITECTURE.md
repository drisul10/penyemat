# Penyemat: technical architecture (v1)

Status: draft, 2026-11-19. Requirements live in PRD.md, design in DESIGN.md and design.html. **Decided** items come from the user's answers on 2026-11-19. **Proposed** items are engineering defaults waiting for confirmation or a benchmark.

## 1. Stack (Decided)

| Area | Choice | User's answer |
| --- | --- | --- |
| Extension framework | WXT (Vite-based, Manifest V3, one codebase for Chromium, Firefox, later Safari) | "WXT" |
| UI | Svelte 5 + TypeScript | "Svelte 5 + TypeScript" |
| Styling | Tailwind CSS v4 for layout and tokens, Svelte scoped CSS for component specifics | "Svelte scoped + Tailwind CSS v4" |
| Search engine | MiniSearch | "MiniSearch" |
| Storage | IndexedDB via Dexie | "IndexedDB via Dexie" |
| Index location | Web Worker in the library page, snapshot persisted in IndexedDB | "Worker in the library page" |
| Index content | Unique words per page, plus title and address | "Unique words per page" |
| Text extraction | Mozilla Readability, fallback to visible text | "Mozilla Readability" |
| PDFs | Not extracted in v1; saved as unreadable (PRD F1.5) | "No, treat PDFs as unreadable" |
| Key derivation | Argon2id via hash-wasm (WebAssembly) | "Argon2id via WebAssembly" |
| Tests | Vitest (logic), Playwright (Chromium e2e), Firefox e2e | "Vitest + Playwright + Firefox e2e" |
| Tooling | pnpm, Biome (lint and format), svelte-check (types) | "pnpm + Biome" |

## 2. Components

```
┌──────────────────────── Browser extension (one origin) ────────────────────────┐
│                                                                                 │
│  Popup (Svelte)            Background service worker        Library page (Svelte)│
│  - shows save result       - toolbar click handler          - shelves, search UI │
│  - category chips          - injects extractor into tab     - paste-a-link fetch │
│  - locked-chip passphrase  - writes bookmark to Dexie       - settings, export   │
│        │                          │                          │        │          │
│        └──────── runtime messages ┘                          │   Search Worker   │
│                                                              │   - MiniSearch    │
│                                                              │   - Argon2id      │
│                                                              │   - snippets      │
│                                                              │        │          │
│  ─────────────────────────── IndexedDB (Dexie) ───────────────────────┘          │
│  bookmarks · categories · lockedRecords · lockMeta · indexSnapshots · settings   │
└─────────────────────────────────────────────────────────────────────────────────┘
        ▲ scripting.executeScript (activeTab)                ▲ fetch (optional host permission)
        │                                                    │
   Current tab: Readability runs in page, returns text   Pasted link's page
```

- **No declared content scripts.** The extractor is injected only on a toolbar click, through `activeTab` + `scripting.executeScript`. No permanent access to every site.
- **The background service worker holds no state.** MV3 stops it after about 30 s idle, so it only handles the click, the injection, and the Dexie write.
- **The library page owns search.** Its worker loads the index, searches off the main thread, and runs Argon2id so unlocking never freezes the UI.

## 3. Permissions

| Permission | Why |
| --- | --- |
| `activeTab`, `scripting` | Read the current page's text on a toolbar click (F1.1). |
| `storage`, `unlimitedStorage` | Room for 10,000 pages of text and the index (C4). |
| `contextMenus` | "Save to Penyemat" and "Save to Locked" in the right-click menu of the toolbar button and of pages (F4.7). |
| `commands` (manifest key, no default key) | Lets users bind "Save to Locked" to a shortcut in the browser's extension shortcut settings (F4.7). |
| `optional_host_permissions: ["<all_urls>"]` | Requested only the first time a user pastes a link, to fetch that page (F1.4, risk K1). |

The library page also calls `navigator.storage.persist()` to make eviction less likely.

## 4. Data model (Dexie)

| Table | Key | Fields | Notes |
| --- | --- | --- | --- |
| `bookmarks` | `id` (uuid) | `url` (normalized, unique index), `title`, `site`, `favicon`, `savedAt`, `updatedAt`, `categoryId`, `text` (≤100 KB), `textStatus` (`ok` \| `unreadable`), `indexState` (`pending` \| `indexed` \| `removed`) | Unlocked bookmarks only. |
| `categories` | `id` | `name`, `order`, `kind` (`starter` \| `custom` \| `unsorted`) | `unsorted` can't be renamed or deleted and always sorts last (F3.1a). |
| `lockedRecords` | `id` (random uuid) | `iv`, `ciphertext`, `indexState` | Ciphertext holds the full bookmark JSON, including URL and dates. Nothing readable is stored outside it. |
| `lockMeta` | singleton | `salt`, `kdf` (`argon2id`, params), `verifierIv`, `verifier`, `shelfName` | The verifier is a known value encrypted with the key, used to check a passphrase. |
| `indexSnapshots` | `kind` (`open` \| `locked`) | `data` (gzipped MiniSearch JSON), `docCount`, `builtAt`, `schemaVersion` | The `locked` snapshot is encrypted before it is stored. |
| `settings` | singleton | `idleMinutes` (default 5, range 1–60), `lastExportAt` | |

**URL normalization (Decided, "Ignore host case, #part, tracking params"):** lowercase the host, drop the `#fragment`, drop `utm_*`, `fbclid`, and `gclid` parameters, and keep the path as is. Two saves are duplicates when their normalized URLs match (F1.3).

## 5. Flows

### 5.1 Save from the toolbar (F1.1–F1.6)
1. The user clicks the toolbar button. Background checks the URL: `chrome://`, `about:`, store pages, and `.pdf` are handled as unsavable (F1.6) or unreadable (F1.5).
2. Background injects Readability with `executeScript` and gets back `{ title, text, favicon }`. When Readability finds no article, it falls back to `document.body.innerText`.
3. The text is cut to its first 100 KB (F1.7). Empty text sets `textStatus: unreadable`.
4. The normalized URL is upserted in `bookmarks` with `indexState: pending`. An existing URL returns "Already saved" (F1.3).
5. The popup opens with the result and the category chips. A chip tap updates `categoryId` only.

Target (Decided, "Saved in 200 ms"): the popup shows "Saved" within 200 ms on a typical article. design.html shows "Saving…" only past 400 ms, so it rarely appears.

### 5.2 Save a pasted link (F1.4)
Runs in the library page, not in background: MV3 service workers have no `DOMParser`.
1. On the first paste, request the optional host permission. If the user declines, save with title and address only.
2. `fetch` the URL, parse it with `DOMParser`, run Readability, then continue from step 3 of 5.1.

### 5.3 Search (F2)
- **Index schema:** fields `title`, `site` (host plus path words), `words` (the page's distinct words, joined). Stored fields: `id`, `savedAt`.
- **Tokenize:** lowercase, split on Unicode letters and digits, drop stop words from the body only, then stem with an English Porter stemmer (Proposed: the `stemmer` npm package, about 2 KB). The same function serves indexing, queries, and snippet matching.
- **Unique words:** `words` is built from the set of tokens of `text`, which cuts index size several times. Body ranking then counts presence, not frequency.
- **Query options:**
  - `boost: { title: 3, site: 1.5, words: 1 }` (Decided, "Title 3, address 1.5, text 1") for title > address > body ranking (F2.6).
  - `fuzzy: (term) => term.length >= 8 ? 2 : term.length >= 4 ? 1 : 0` (F2.3 defaults).
  - `prefix: (term, i, terms) => i === terms.length - 1` (F2.4).
  - Ties are broken by `savedAt`, newest first (F2.6).
- **Snippets (F2.7):** for the top 20 results, the worker reads `text` from Dexie, finds the first matched token, cuts about 160 characters around it on word boundaries, and returns highlight ranges. The UI renders them in tomato.
- **Keystrokes:** the UI debounces input by 150 ms and sends queries to the worker. A newer query cancels the older one.
- **Target (Decided, "search in 20 ms"):** under 20 ms per query in the worker at 10,000 bookmarks (F2.9). Benchmark before freezing the index design (risk T2).

### 5.4 Index lifecycle
1. The library page opens. The worker loads the `open` snapshot and gunzips it with `DecompressionStream`.
2. The worker queries `bookmarks` where `indexState` is `pending` or `removed`, then adds, replaces, or discards those documents.
3. After changes, the worker writes a new snapshot 1 s after the last change (Decided, "save index after 1 s"), and marks the rows `indexed` in the same transaction.
4. If the snapshot is missing or its `schemaVersion` is old, the worker rebuilds from `bookmarks` and shows shelves while search warms up (risk K3).

### 5.5 Locked shelf (F4)
- **Setup:** the user enters a passphrase (min 8 characters, F4.10) and confirms the "can't be recovered" warning (F4.8). Generate a 16-byte salt. Derive a 32-byte key with Argon2id (Decided, "19 MiB, 2 passes": m = 19 MiB, t = 2, p = 1, the OWASP minimum, chosen so one library unlocks on desktop, Firefox for Android, and later Safari on iOS), import it as an AES-GCM 256 key with `extractable: false`, and store `salt`, `kdf`, and the verifier.
- **Records:** each locked bookmark is encrypted as a whole with a fresh 12-byte IV. The locked index is a second MiniSearch instance whose snapshot is encrypted the same way.
- **Unlock:** the worker derives the key, checks the verifier, decrypts the locked snapshot and pending locked records, and searches both indexes, merging results by score. No attempt limit (F4.11).
- **Shared across tabs:** an unlocked tab answers `BroadcastChannel('penyemat-lock')` requests from new library tabs with the raw key bytes, so the user unlocks once. When the last tab closes, the key is gone (F4.6).
- **Relock:** each tab runs an idle timer (`idleMinutes`, reset on input). On timeout it broadcasts `lock`, and every tab drops the key, the decrypted records, and the locked index from memory.
- **Save to Locked (F4.7):** the context-menu item or shortcut injects the extractor like 5.1, but background keeps the result in memory and opens the popup in "Save to Locked" mode. The popup derives the key from the typed passphrase, checks the verifier, encrypts the page, and writes it to `lockedRecords` with `indexState: pending`. Nothing is written to `bookmarks`, so no plaintext ever touches disk.
- **Move to Locked (popup chip):** for a page already in `bookmarks`, encrypt it into `lockedRecords` and delete the plain row in one transaction. The UI warns that IndexedDB may keep traces of the deleted plain copy.
- **Change passphrase (F4.9):** derive the new key, re-encrypt every locked record and the locked snapshot in one Dexie transaction, and replace `lockMeta`.

### 5.6 Export and import (F5)
- **Export file:** `{ format: "penyemat-export", version: 1, exportedAt, categories, bookmarks, locked: { lockMeta, records } }`. Bookmarks include their text. Locked records stay ciphertext (F5.2). Indexes are not exported. Sets `settings.lastExportAt` (F5.5).
- **Import:** validate format and version, then for each bookmark compare normalized URLs. On a match keep the newer `savedAt`; otherwise insert. Mark everything `pending` and rebuild the index. Finish with "Imported N, updated N, skipped N" (F5.4).
- **Locked records on import:**
  - The library has no locked shelf: adopt the file's `lockMeta` and records as they are.
  - Both have one: ask for the file's passphrase, decrypt, compare URLs with the unlocked library shelf, and re-encrypt with the current key. If the user skips that, the locked part of the file is not imported, and the summary says so.

## 6. Project layout (WXT)

```
penyemat/
  wxt.config.ts            manifest, permissions, Svelte + Tailwind plugins
  src/
    entrypoints/
      background.ts        toolbar click, injection, save
      popup/               Svelte popup
      library/             Svelte library page (index.html)
    workers/search.worker.ts
    lib/
      db/                  Dexie schema and migrations
      extract/             Readability wrapper, 100 KB cap, unsavable checks
      search/              tokenizer, stemmer, MiniSearch config, snippets
      crypto/              Argon2id, AES-GCM, verifier, BroadcastChannel key share
      backup/              export, import, merge
      url.ts               normalization
    styles/tokens.css      Tailwind v4 @theme from DESIGN.md tokens
  tests/
    unit/                  Vitest
    e2e/                   Playwright (Chromium), Firefox runner
```

## 7. Styling

- `styles/tokens.css` declares DESIGN.md colours, fonts, radius, and spacing in Tailwind v4 `@theme`, so they exist both as utilities and as CSS variables.
- Layout and spacing use Tailwind utilities. Component-specific shapes (the folded corner `clip-path`, the fold animation) live in Svelte scoped `<style>` blocks that read the same variables.
- Fonts (Zilla Slab, Work Sans) are bundled as local `woff2` files. Extensions should not load Google Fonts at runtime (C1, no third-party requests).

## 8. Testing

| Layer | Tool | Covers |
| --- | --- | --- |
| Unit | Vitest | tokenizer and stemmer, fuzzy and prefix rules, ranking order, snippet ranges, URL normalization, 100 KB cap, Argon2id + AES-GCM round trip, wrong passphrase, export/import merge counts |
| E2E Chromium | Playwright `launchPersistentContext` with the built extension | save, already saved, category pick, search with typo, lock setup, unlock, relock on idle, popup save into locked, export then import |
| E2E Firefox | `web-ext` + Selenium WebDriver BiDi (Playwright can't load Firefox extensions) | the same core flows: save, search, unlock |
| Performance | Vitest bench on a generated 10,000-page library | index load time, query time (F2.9), snapshot size |

## 9. Risks

| ID | Risk | Mitigation |
| --- | --- | --- |
| T1 | Playwright doesn't support Firefox extensions, so Firefox e2e needs a second runner. | `web-ext` + Selenium BiDi. Keep the Firefox suite to core flows. |
| T2 | The MiniSearch index for 10,000 pages may exceed memory or load-time targets even with unique words. The 20 ms query target is tight: 2-typo fuzzy matching across a large vocabulary can take longer. | Benchmark in week 1. Fallbacks: shard the index by category, cap distinct words per page, or limit fuzzy expansion per term. |
| T3 | Biome's Svelte support covers scripts and styles but not all template rules. | Run `svelte-check` in CI for types and template errors. |
| T4 | 19 MiB, 2-pass Argon2id is the OWASP minimum. With an 8-character passphrase and no attempt limit, a copied library or export file is much cheaper to guess offline than with 46 or 64 MiB. | Parameters are stored in `lockMeta`, so a later version can raise them on the next passphrase change. Setup suggests a longer passphrase. |
| T5 | Firefox `unlimitedStorage` and eviction behave differently from Chromium. | Test quota early. Show the last export date. |
| T6 | Sharing the key over BroadcastChannel puts it in every open library tab's memory. | Same origin only. Dropped on relock. This is accepted because the PRD requires one unlock across tabs. |

## 10. Open questions

None. A1 answered 2026-11-19: boosts (5.3), Argon2id parameters (5.5), speed targets and snapshot delay (5.1, 5.3, 5.4), URL normalization (section 4).
