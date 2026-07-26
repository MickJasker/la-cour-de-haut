# ADR-0024: Cached outbound iCal export feed; health signal written on origin fetch

**Status:** Accepted

## Context

Platforms poll the export feed (`/api/ical/{token}.ics`) on their own schedule — typically every 15 minutes to a few hours, per token. Every poll hit the database four ways: a token `SELECT`, a fire-and-forget `lastAccessedAt` `UPDATE` (the ADR-0007 health signal), and two `SELECT`s for bookings and blocks, with the response sent `Cache-Control: no-store`. Neon autosuspends after ~5 minutes idle, so this polling alone kept the database awake around the clock — the dominant source of compute hours on an otherwise low-traffic site.

Caching only the reads would not help: **any** connection resets Neon's autosuspend timer, so the single `UPDATE` per poll wakes the database exactly as much as all four queries. The success criterion is therefore _zero_ database touches on a cache hit. That collides with two prior promises: ADR-0007's per-poll `lastAccessedAt` health signal, and its instant-404-on-revocation behaviour. It is also the same observability tension ADR-0005 identified for inbound feeds — a truthful "this happened" write cannot coexist with an opaque cache — resolved here in the opposite direction because the write, not the read, is what matters.

## Decision

Serve the feed from a `"use cache"` helper function (the Next 16 Cache Components pattern for cached GET route handlers; the directive cannot sit in the handler body itself). The helper takes the token, returns the response status + `.ics` body, and carries:

- `cacheTag(CACHE_TAGS.icalExport)` — one tag for all token URLs, since every data change affects every subscriber.
- `cacheLife` ≈ 1 hour revalidate — the backstop for **time-driven** transitions that no mutation ever announces: lazy hold expiry (ADR-0004) and bookings aging into the past.
- **Negative caching**: unknown-token 404 responses are cached under the same tag. A revoked platform keeps polling its dead URL for months; uncached 404s would wake the database on every such poll forever.
- The `lastAccessedAt` write moves **inside** the cached function, awaited at fill time. Its meaning changes from "last poll" to "**last origin fetch**" — frozen while the cache is warm, bumped when a poll reaches the origin. The admin UI is relabelled accordingly. This amends ADR-0007.

**Event-driven** invalidation via `updateTag(CACHE_TAGS.icalExport)` from every mutation that changes feed content: booking status transitions (confirm, decline, cancel, payment marks that alter status), owner block create/delete, and export token create/delete (so revocation still takes effect on the platform's next poll, as ADR-0007 promised).

The cached helper must not call `connection()` (illegal inside `"use cache"`); the booking/block reads are reachable without it. The response header stays `no-store` toward platforms — the cache is ours; letting platform HTTP layers also cache would stack uncontrolled staleness on top.

## Consequences

- Between data changes and hourly revalidations, polls are served with zero database connections; Neon actually sleeps.
- Staleness only ever **over-blocks** (an expired hold shows as busy on platforms for up to an hour). It can never cause a double booking — the safe error direction, consistent with "sync is not instant" (CONTEXT.md).
- `lastAccessedAt` degrades from per-poll to per-origin-fetch granularity. The core diagnostics survive: a new token's first poll is always a miss (setup verification), and a platform that stops polling goes permanently stale. What's lost is poll-cadence visibility.
- Negative caching is per-URL, so it's weaker than it sounds: the _first_ probe of each unique unknown token still fills once (one DB wake), and because the single `ical-export` tag also covers 404 entries, every mutation lets a revoked platform's next dead poll re-fill. "Never wakes the DB" holds only between mutations for already-cached URLs. Distinct-token flooding (one wake + one cache entry per unique probe) is bounded by LRU eviction and the 1-day expire — accepted, since it's no worse than the pre-cache behaviour of a DB hit on _every_ probe.
- The zero-DB-touch guarantee rests on the deployment platform backing the cache with a persistent shared store. **Amendment (2026-07-26):** plain `"use cache"` does _not_ provide this on Vercel — it stores entries in an in-memory LRU private to one Lambda instance, and instances are recycled between polls minutes apart, so production logs showed 100% cache misses (every poll still hit the DB). Switched to `"use cache: remote"`, which backs the same `cacheTag`/`cacheLife`/`updateTag` API with Vercel's Runtime Cache — shared across instances — at the cost of a network round-trip per lookup. No other part of this ADR's design changes.
- `DTSTAMP` reflects cache-fill time, not serve time — cosmetically stale, semantically fine (RFC 5545 allows it; platforms key on `UID`).
- Two concurrent misses can both fill and both write `lastAccessedAt` — idempotent and harmless, mirroring ADR-0005's unguarded concurrent refresh.
