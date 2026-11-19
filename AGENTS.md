# AGENTS.md

Instructions for coding agents working on Penyemat. Claude Code reads this file through `CLAUDE.md`.

## Project

Penyemat is a bookmark manager that runs entirely inside a browser extension. Users save a page in one click, sort it onto shelves, and find it again by any words from the page. One shelf can be locked and encrypted with a passphrase.

Status: v1 is built locally (2026-11-19): the extension, unit tests, Chromium and Firefox e2e suites, and the search benchmark. Nothing is published to a store yet.

## Read first

| File | What it holds | Canonical? |
| --- | --- | --- |
| `PRD.md` | Requirements, constraints, acceptance checks (F1–F5, N1–N5) | Yes |
| `DESIGN.md` | Users, visual direction and tokens, business rules (Decided / Not decided) | Yes |
| `ARCHITECTURE.md` | Stack, components, data model, flows, permissions, tests | Yes |
| `design.html` | Screens and states to build (library, search, organize, extension) | Yes, for UI |
| `directions.html`, `alternatives.html` | Design history: rejected directions and layouts | No, reference only |
| `wiki/` | Obsidian LLM wiki: sources, summaries, entity pages, log | No, it links back to the canonical files |

When the canonical files and the wiki disagree, the canonical files win. Fix the wiki.

## Hard rules

1. **This repository is public. Never commit secrets, developer data, or personal setup.** That covers API keys, tokens, passwords, certificates, `.env` files, signing keys, real bookmarks or browsing data, personal names, emails, usernames, absolute local paths (such as `/Users/<name>/...` or `C:\Users\...`), machine names, and personal editor, OS, or AI-tool configuration. Use placeholders (`<YOUR_KEY>`), relative paths, and `.env.example` with empty values. Test fixtures use invented sample data on `example.com` domains. Before finishing any task, check the diff for these, and add new personal files to `.gitignore` instead of committing them.
2. **No server of any kind.** No backend, no database server, no analytics, no telemetry, no third-party requests (fonts and libraries are bundled). The only network request the product makes is fetching a page the user pasted (PRD F1.4).
3. **Locked-shelf data is never stored as plaintext**, and the derived key never touches disk (PRD F4.2, F4.4).
4. **Do not invent product rules.** A business rule moves from Not decided to Decided in DESIGN.md only on the owner's own words, quoted with the date.

## Ask before

- Adding a runtime dependency.
- Adding or widening a manifest permission.
- Changing the Dexie schema (needs a migration).
- Touching anything under `src/lib/crypto/` or the Argon2id parameters.
- Changing a canonical document's Decided content.

## Stack

WXT (Manifest V3) · Svelte 5 + TypeScript · Tailwind CSS v4 + Svelte scoped CSS · MiniSearch in a Web Worker · Dexie (IndexedDB) · Mozilla Readability · hash-wasm Argon2id + Web Crypto AES-GCM · Vitest · Playwright (Chromium) · `web-ext` + Selenium BiDi (Firefox) · pnpm · Biome · svelte-check.

Targets: Chromium and Firefox in v1. Safari comes after v1.

## Commands

Planned scripts. Create them with exactly these names when scaffolding.

| Command | Does |
| --- | --- |
| `pnpm install` | Install dependencies |
| `pnpm dev` / `pnpm dev:firefox` | Run the extension with hot reload (WXT) |
| `pnpm build` / `pnpm build:firefox` | Production builds |
| `pnpm lint` | `biome check .` |
| `pnpm format` | `biome format --write .` |
| `pnpm check` | `svelte-check` (types and templates) |
| `pnpm test` | Vitest unit tests |
| `pnpm e2e` | Playwright e2e against the Chromium build |
| `pnpm e2e:firefox` | Firefox e2e via `web-ext` + Selenium BiDi |
| `pnpm bench` | Search benchmark on a generated 10,000-page library |

## Layout

Follow ARCHITECTURE.md section 6: `src/entrypoints/{background.ts,popup/,library/}`, `src/workers/search.worker.ts`, `src/lib/{db,extract,search,crypto,backup}/`, `src/lib/url.ts`, `src/styles/tokens.css`, `tests/{unit,e2e}/`.

## Definition of done (code)

1. `pnpm lint`, `pnpm check`, and `pnpm test` pass. Don't silence errors with casts, disabled rules, or skipped tests.
2. When save, search, lock, or backup flows change, `pnpm e2e` and `pnpm e2e:firefox` also pass.
3. When search or indexing changes, `pnpm bench` stays within PRD F2.9 (20 ms per query at 10,000 bookmarks).
4. The diff has no secrets, personal data, or absolute local paths (hard rule 1).
5. The wiki is updated when the task changed a decision or behavior (see Wiki).
6. Report what ran and what didn't. Never claim a check you didn't run.

## QA

- **Use the `/qa` skill (gstack qa) for QA passes**: after a user flow is built or changed (save, search, shelves, lock, backup), and before a feature is called done. Run it against the dev build (`pnpm dev`, `pnpm dev:firefox`). An agent without the skill says so in its report.
- The skill is installed locally in `.claude/skills/qa/` and is not committed (hard rule 1). It needs a global gstack install for its browser. Without one, it runs in degraded mode and browser probes are reported as blocked.
- This file overrides the skill:
  - The skill commits each fix by itself. Here, fixes stay uncommitted until the owner asks (see Git).
  - Reports and screenshots go to `.gstack/qa-reports/`, which is git-ignored. Never commit them. They can show browsing data.
  - Installing packages, bootstrapping test frameworks, or creating CI workflows needs the owner's approval first (see Ask before).
  - Use only invented test data on `example.com` domains, and never a real account or real bookmarks.
- QA findings that change behavior update the wiki like any other change.

## Parallel work and subagents

Agents may split a task and run parts in parallel, with subagents or several agents at once.

- Split only work that is independent: different files or modules, or research that changes no files. Work that touches the same files runs in sequence, or in separate git worktrees.
- Every subagent follows this whole file, including the hard rules and the UI skill rules. Give each one the task, the files it owns, and the checks it must pass.
- Subagents don't decide anything on the "Ask before" list. They stop and report it to the lead agent, which asks the owner.
- The lead agent merges the results, runs the definition of done on the combined change, and updates `wiki/index.md` and `wiki/log.md` once, so parallel edits don't conflict.
- The final report says which parts ran in parallel and what each one checked.

## UI work

- **Always use the `/ryux` and `/impeccable` skills when working on UI** (designing, building, changing, or reviewing any screen, component, or style). An agent without those skills says so in its report, so a human or another agent can run them.
- Use only the DESIGN.md tokens, through `src/styles/tokens.css` (Tailwind v4 `@theme`). No raw hex values in components.
- Build every state that design.html shows for the screen: loading, empty, error, success.
- Render the result at 1440, 390, and 320 px wide. No sideways page scroll at any of them.
- Check text contrast against WCAG 2.2 AA. The palette in DESIGN.md lists measured pairs.
- Marigold (`#FFC21A`) appears only in the brand band and the save moment, never behind lists.
- Interface copy is English, plain, and specific. Errors say what happened and what to do next.
- **Always run the `/humanizer` skill when adding or updating UI wording** (labels, buttons, messages, empty states, errors, onboarding, store listing). Apply its result before finishing. An agent without that skill says so in its report, so a human or another agent can run it.

## Git

- Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, `build:`, `ci:`.
- Commit only when asked. Don't add `Co-authored-by` trailers.
- Never commit anything that hard rule 1 forbids. Check `git diff --staged` before every commit.

## Wiki (Obsidian LLM wiki)

`wiki/` is an Obsidian vault maintained by agents, following the LLM Wiki pattern.

```
wiki/
  raw/YYYY-MM-DD/   untouched source snapshots. Never edit; add a new dated folder instead
  sources/          one summary page per ingested source
  features/         product features (from PRD.md)
  components/       code components (from ARCHITECTURE.md)
  decisions/        decisions with options, choice, and reason
  concepts/         ideas that cross features (signature, key sharing, normalization)
  questions/        open questions and unverified risks
  templates/        Templater templates, one per page type
  index.md          catalog of every page, grouped by type, one line each
  log.md            append-only record of ingest, query, and lint passes
  dashboard.md      Dataview views (open questions, decisions, recent changes)
```

**When to update:** after any task that changes a decision or behavior, update the affected pages, `index.md`, and `log.md` in the same change. Pure refactors and typo fixes skip it.

**Page format:** file names are kebab-case and unique across the vault. Each page starts with this frontmatter:

```yaml
---
type: source | feature | component | decision | concept | question
status: decided | proposed | open | active | superseded
sources: ["[[source-page]]"]
canonical: PRD.md#section   # canonical file and section, or "none"
updated: YYYY-MM-DD
tags: []
---
```

Body: a one-paragraph summary, key points with references (PRD IDs like F4.6, ARCHITECTURE sections), then a `## Related` list of `[[wikilinks]]`. Summarize and link. Don't copy rules from the canonical files, so they can't drift.

**Operations:**
- **Ingest:** copy the new source into `raw/<today>/`, write its `sources/` page, create or update the entity pages it touches, update `index.md`, and append to `log.md`.
- **Query:** answer from the wiki first, then the canonical files. If the answer is new and reusable, save it as a page and log it.
- **Lint:** look for broken links, orphan pages, missing frontmatter, stale `updated` dates, pages that contradict the canonical files, and `index.md` entries without a page. Fix them and log the pass.

**Log entry format** (one heading per entry, so it can be grepped):

```
## [YYYY-MM-DD] ingest | <title>
- what changed, pages touched
```

**Plugins:** core plugins, Dataview, and Templater. `index.md` stays a plain list so it reads without plugins. Dataview queries live only in `dashboard.md`. Templater templates are in `wiki/templates/`.
