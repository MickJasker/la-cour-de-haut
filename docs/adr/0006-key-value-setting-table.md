# ADR-0006: Key-value `setting` table with Zod-parsed accessors

**Status:** Accepted

## Context

The admin needs configurable values for the bank-transfer email (IBAN, bank name, account holder) and for booking logic (payment deadline days). These values are owner-managed singleton scalars — not relational data.

Two shapes were considered:

1. **Typed singleton row** — one row with named columns per setting. Type-safe at the DB layer but requires a migration for every new setting.
2. **Key-value rows** — `(key TEXT PRIMARY KEY, value TEXT)`. One row per setting. New keys require no schema change.

## Decision

Use a key-value table. Known keys and their types are declared in a single Zod schema in the application layer; all reads go through a typed accessor that parses and validates values against that schema.

## Consequences

- Adding a new setting is a code-only change — no migration.
- The Zod schema is the single source of truth for what keys exist and what their types are.
- DB-level type safety is lost (all values are `TEXT`), but the accessor layer recovers it.
- If a required key is missing, the accessor returns `undefined`; callers handle the absent-settings case explicitly (e.g. disabling the confirm button in the inbox).
