# ADR-0005: DB-materialized lazy refresh for inbound iCal, not fetch-layer ISR

**Status:** Accepted

## Context

Inbound platform feeds (Airbnb, Natuurhuisje, and future sources) must be fetched, parsed, and merged into busy intervals to drive the booking form's availability. The obvious Next.js approach is fetch-layer ISR — `fetch(url, { next: { revalidate: 3600 } })` — which is what issue #5 originally proposed ("cache via Next.js ISR").

But the owner needs per-source **sync health** (when did we last pull this feed, did it error). Fetch-layer ISR makes this impossible to record truthfully: `fetch` does not tell the caller whether a response was served from cache or freshly fetched, so a "last synced" write would fire on every render or never. Observability is inherently a write that must happen exactly when a real fetch occurs — which means we have to own the refresh rather than delegate it to opaque fetch caching.

## Decision

Model each feed as a first-class `ical_source` row that materializes its own last-known result (`cachedIntervals`, `lastSyncedAt`, `lastError`, `lastErrorAt`). Refresh **lazily on read**: `getBusyIntervals()` re-fetches a source only when it is older than ~1 hour, writes the result (or error) back to the row, and otherwise reads `cachedIntervals` directly. Live DB holds are merged on every call (never cached). The refresh write happens inside the server-action path, not bare render. This mirrors the lazy-on-read, no-cron philosophy of [ADR-0004](./0004-lazy-hold-expiry-no-cron.md).

## Consequences

- Accurate per-source observability surfaced in `/admin/settings`, written precisely when a fetch happens.
- A feed failure fails to **last-known-good** (`cachedIntervals` retained, `lastSyncedAt` not bumped, retry next read). A source that has _never_ synced contributes no busy dates (fail-open) — acceptable because the human confirm + bank-transfer step is the real double-booking safeguard.
- Two concurrent stale reads can both fetch and upsert. Idempotent and harmless at this traffic; not guarded.
- **Recurring events (`RRULE`) are not expanded.** Airbnb and Natuurhuisje publish concrete one-off blocks; a future source that uses recurrence rules would silently miss busy dates until expansion is added.
- Diverges from the issue's literal "ISR" wording, but keeps the public surface off the network on most requests without a cron.
