# ADR-0007: Per-service export tokens in a dedicated table, not a single `setting` key

**Status:** Accepted — superseded in part by [ADR-0024](./0024-cached-ical-export-feed.md): the feed is now served from a cache, so `lastAccessedAt` is written on **origin fetch** (cache miss), not on every request, and revocation's 404 takes effect via tag invalidation on token delete rather than on the very next poll unconditionally. The table design and per-service revocation model below stand unchanged.

## Context

Issue #11 originally specified `setting.ical_export_token` — a single secret stored in the key-value `setting` table — as the access control mechanism for the outbound iCal feed. With one token, rotating it (if it leaked) or revoking one platform's access would break all other subscribers simultaneously.

## Decision

Replace the single-token design with a dedicated `ical_export_token` table:

```
ical_export_token(id, name, token, lastAccessedAt, createdAt)
```

Each row represents one platform (e.g. "Airbnb", "Natuurhuisje"). The owner creates tokens from `/admin/ical/export`. Deleting a row revokes only that platform's access; other subscribers are unaffected. `lastAccessedAt` is written on each successful feed request (fire-and-forget), giving the owner a per-service polling health signal.

No `enabled` flag — tokens that should be inactive are deleted outright.

## Consequences

- Any platform whose token is deleted immediately loses access (next poll returns 404), without disrupting others.
- `lastAccessedAt` surfaces whether a platform is actually polling the feed after setup.
- Slightly more schema surface than a single `setting` key, but mirrors the `ical_source` pattern already established for inbound feeds — the symmetry is intentional.
- The `ICAL_EXPORT_TOKEN` env var (legacy from the original spec) is dead code and should be removed from all environments.
