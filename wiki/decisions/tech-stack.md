---
type: decision
status: decided
sources: ["[[architecture-2026-11-19]]"]
canonical: ARCHITECTURE.md#1-stack-decided
updated: 2026-11-19
tags: []
---

# Tech stack

**Decision:** WXT, Svelte 5 + TypeScript, Tailwind v4 + scoped CSS, MiniSearch, Dexie, Readability, hash-wasm, Vitest, Playwright, web-ext, pnpm, Biome.

**Options considered:** Per area in ARCHITECTURE section 1 (for example Plasmo or CRXJS; Preact, React, or Solid; Orama or FlexSearch; idb).

**Why:** Cross-browser MV3 builds from one codebase, a small fast popup, and a tiny search library.

**Cost:** Biome covers Svelte templates only partly (T3); Firefox e2e needs a second runner (T1).

Decided by the owner on 2026-11-19.

## Related

- [[no-server]]
- [[search-worker]]
- [[dexie-store]]
- [[firefox-e2e-runner]]
