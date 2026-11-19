# Penyemat

Penyemat is a bookmark manager that runs entirely inside your browser. Save a page in one click, sort it onto shelves, and find it again later by any word you remember from the page.

There is no server and no account. Your links, their page text, and the search index are stored in your browser profile, and the locked shelf is encrypted there too. The only network request Penyemat makes is fetc## Features

- The toolbar button saves the current page with its readable text, using Mozilla Readability and keeping up to 100 KB per page. Saving the same address again doesn't create a second copy.
- Search covers titles, addresses, and page text, and runs in a Web Worker. It tolerates typos, completes the last word as you type, and understands English word endings, so "recipe" finds "recipes". It also finds a word inside a longer one: "nikah" finds "Menikah". Shelves whose names match show above the results, and chips narrow the results to one category.
- You can add, rename, reorder, and delete categories. A link moves to another shelf from its ⋯ menu or by dragging it there, and a deleted link can be restored with Undo for 10 seconds.
- One shelf can be locked with a passphrase and encrypted with Argon2id and AES-GCM 256. The key lives only in memory, and the shelf locks again after the idle time you set or when you close the last library tab. A forgotten passphrase cannot be recovered.
- Export writes the whole library to one file, with locked links still encrypted, and Import reads it back. Optional autosave writes a backup after changes, at most once an hour, to your Downloads folder or, in Chromium browsers, a folder you choose. The browser also keeps the last 7 autosaves, which you can restore from Settings.

 last 7 copies are also kept in the browser.

## Install for development

You need Node.js and pnpm.

```sh
pnpm install
pnpm dev            # Chrome with hot reload
pnpm dev:firefox    # Firefox with hot reload
```

To load a production build by hand:

```sh
pnpm build          # writes .output/chrome-mv3
pnpm build:firefox  # writes .output/firefox-mv3
```

- **Chrome, Edge, Brave:** open `chrome://extensions`, turn on Developer mode, choose **Load unpacked**, and pick `.output/chrome-mv3`.
- **Firefox:** open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and pick `.output/firefox-mv3/manifest.json`.

## Scripts

| Command | Does |
| --- | --- |
| `pnpm dev` / `pnpm dev:firefox` | Run the extension with hot reload |
| `pnpm build` / `pnpm build:firefox` | Production builds |
| `pnpm zip` | Package the build for a store |
| `pnpm lint` | Biome lint and format check |
| `pnpm format` | Format with Biome |
| `pnpm check` | `svelte-check` types and templates |
| `pnpm test` | Vitest unit tests |
| `pnpm e2e` | Playwright end-to-end tests in Chromium |
| `pnpm e2e:firefox` | Firefox end-to-end tests (web-ext and Selenium WebDriver BiDi) |
| `pnpm bench` | Search benchmark on a generated 10,000-page library (target: 20 ms per query) |

The end-to-end suites build a separate test copy into `.output-e2e/` that already has access to all sites, because automation can't click the toolbar button or answer a permission prompt. Load `.output/` for manual testing, not `.output-e2e/`. The Firefox suite lets Selenium Manager download Firefox and geckodriver if they are missing.

## Permissions

| Permission | Why |
| --- | --- |
| `activeTab`, `scripting` | Read the current page's text when you save it |
| `storage`, `unlimitedStorage` | Room for the library and its search index |
| `contextMenus` | "Save to Penyemat" and "Save to Locked" in the right-click menu |
| `downloads`, `alarms` | Autosave on a schedule into your Downloads folder |
| Optional: all sites | Asked the first time you paste a link, to fetch that page |

## Stack

WXT (Manifest V3), Svelte 5, TypeScript, Tailwind CSS v4, MiniSearch, Dexie (IndexedDB), Mozilla Readability, hash-wasm (Argon2id), and Web Crypto. It is tested with Vitest, Playwright, and Selenium, and checked with Biome and svelte-check. Chromium browsers and Firefox are supported; Safari comes after v1.

## Documentation

- [PRD.md](PRD.md): requirements and acceptance checks
- [DESIGN.md](DESIGN.md): visual direction, tokens, and business rules
- [ARCHITECTURE.md](ARCHITECTURE.md): components, data model, flows, and tests
- [AGENTS.md](AGENTS.md): rules for coding agents working on this repository
- [wiki/](wiki/): an Obsidian vault that summarizes and links the documents above

## License

[MIT](LICENSE)
