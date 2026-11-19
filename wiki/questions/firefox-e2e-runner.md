---
type: question
status: open
sources: ["[[architecture-2026-11-19]]"]
canonical: ARCHITECTURE.md#8-testing
updated: 2026-11-19
tags: []
---

# Which runner covers Firefox e2e?

Playwright can't load Firefox extensions (ARCHITECTURE T1). The plan is `web-ext` with Selenium WebDriver BiDi, limited to core flows (save, search, unlock).

- **How to answer:** prove one save-and-search test runs in CI with this setup.

## Related

- [[tech-stack]]
