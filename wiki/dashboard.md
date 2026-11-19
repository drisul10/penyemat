# Dashboard

Dataview views. Inside Obsidian these render as tables; elsewhere use [[index]].

## Open questions

```dataview
TABLE status, updated, canonical
FROM "questions"
WHERE status = "open"
SORT updated DESC
```

## Decisions

```dataview
TABLE status, updated, canonical
FROM "decisions"
SORT file.name ASC
```

## Recently updated

```dataview
TABLE type, status, updated
FROM "sources" OR "features" OR "components" OR "decisions" OR "concepts" OR "questions"
SORT updated DESC
LIMIT 15
```

## Pages missing frontmatter

```dataview
LIST
FROM "sources" OR "features" OR "components" OR "decisions" OR "concepts" OR "questions"
WHERE !type OR !status OR !updated
```
