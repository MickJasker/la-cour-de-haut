# ADR-0003: jsonb columns for translatable content fields

**Status:** Accepted

## Context

Dynamic content (POI titles/bodies, review bodies, content blocks) must exist in four locales (nl, en, fr, de). We also need to track which fields were auto-translated vs. human-edited, so that a re-translate action does not overwrite manual edits.

Two structural options:

- **One column per language** — e.g. `title_nl`, `title_en`, `title_fr`, `title_de`. Strict types, verbose, schema changes if locales are ever added.
- **jsonb keyed by locale** — single `title jsonb` column, parallel `title_source jsonb` column. Flat tables, locale-agnostic schema, weaker compile-time type inference.

## Decision

Each translatable field is stored as a `jsonb` column keyed by locale, with a parallel `_source` column tracking `"human"` or `"machine"` per locale key.

```
title:        { nl: "...", en: "...", fr: "...", de: "..." }
title_source: { nl: "human", en: "machine", fr: "human", de: "machine" }
```

The re-translate action only fills keys that are missing or still `"machine"`.

## Consequences

- Tables stay flat; no join per locale; no column proliferation.
- Adding a locale later requires no schema migration.
- Application code must validate the jsonb shape; Drizzle types are less precise than one-column-per-language.
- The `_source` pattern makes the re-translate action straightforward and safe.
