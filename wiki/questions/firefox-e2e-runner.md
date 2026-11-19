---
type: question
status: decided
sources: ["[[architecture-2026-11-19]]"]
canonical: ARCHITECTURE.md#8-testing
updated: 2026-11-19
tags: []
---

# Which runner covers Firefox e2e?

Playwright can't load Firefox extensions (ARCHITECTURE T1). The plan is `web-ext` with Selenium WebDriver BiDi, limited to core flows (save, search, unlock).

- **How to answer:** prove one save-and-search test runs in CI with this setup.

- **Answer (2026-11-19):** `pnpm e2e:firefox` runs `tests/e2e/firefox/run.mjs`. It uses Selenium WebDriver BiDi with a temporary add-on and a local proxy for the example.com fixtures, and covers save, already saved, search with a typo, lock setup, wrong passphrase, and unlock. It passes locally. No CI is set up.

## Related

- [[tech-stack]]
