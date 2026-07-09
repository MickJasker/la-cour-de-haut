import "server-only";
import { z } from "zod";
import { connection } from "next/server";
import type { BusyInterval } from "@/db/schema";
import { fetchIcalFeed, type IcalFetchResult } from "./ical-fetch";
import {
  expandInterval,
  hasConflict,
  isActiveDirectBooking,
} from "./availability-utils";
import { toUtcDayString } from "./calendar-day";
import {
  productionAvailabilityStore,
  type AvailabilityStore,
  type IcalSourceRow,
} from "./availability-store";

export type { BusyInterval };

// Matches the lazy-refresh threshold documented in CONTEXT.md and ADR-0005
// (DB-materialized lazy refresh) — a source is re-fetched on read once it's
// older than 5 minutes.
const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

const busyIntervalSchema = z.array(
  z.object({ start: z.string(), end: z.string() }),
);

export type FetchFeed = (url: string, now: Date) => Promise<IcalFetchResult>;
export type Clock = () => Date;

/**
 * The module's three injected seams (see the module doc comment below):
 * the DB store, the feed fetch, and the clock.
 */
export type AvailabilityDeps = {
  store: AvailabilityStore;
  fetchFeed: FetchFeed;
  clock: Clock;
};

/**
 * Production wiring for `AvailabilityDeps`. Every exported function below
 * defaults to this, so existing callers (booking form, submit-time re-check,
 * confirm-time re-check, export feed) need no changes. Tests pass their own
 * `AvailabilityDeps` instead — an in-memory store, a scripted fetch, and a
 * fixed clock — rather than mocking `@/db`, `drizzle-orm`, or sibling
 * modules.
 */
const defaultDeps: AvailabilityDeps = {
  store: productionAvailabilityStore,
  fetchFeed: (url, now) => fetchIcalFeed(url, fetch, now),
  clock: () => new Date(),
};

/**
 * Checks whether the source's cache is stale (older than 5 minutes, or never
 * synced). If stale, fetches fresh data and writes it back through the store.
 * Returns the current intervals: fresh on success, last-known-good on
 * failure, and empty for a never-synced source that fails (fail-open,
 * ADR-0005).
 */
async function refreshSourceIfStale(
  source: IcalSourceRow,
  { store, fetchFeed, clock }: AvailabilityDeps,
): Promise<BusyInterval[]> {
  const now = clock();

  const isStale =
    !source.lastSyncedAt ||
    now.getTime() - source.lastSyncedAt.getTime() > REFRESH_INTERVAL_MS;

  if (!isStale) {
    const parsed = busyIntervalSchema.safeParse(source.cachedIntervals);
    return parsed.success ? parsed.data : [];
  }

  const result = await fetchFeed(source.url, now);

  if (result.ok) {
    await store.recordIcalSyncSuccess(source.id, result.intervals, now);
    return result.intervals;
  }

  await store.recordIcalSyncError(source.id, result.error, now);
  // Retain last-known-good intervals
  const parsed = busyIntervalSchema.safeParse(source.cachedIntervals);
  return parsed.success ? parsed.data : [];
}

/**
 * Returns all on_hold (non-expired) and confirmed direct bookings.
 * This is the single canonical filter for which bookings count as busy.
 *
 * Fetches both statuses from the store, then filters with the shared
 * `isActiveDirectBooking` predicate (ADR-0004) instead of re-encoding the
 * expiry comparison in SQL — keeps this in lockstep with display status and
 * dashboard categorisation, which apply the same predicate.
 *
 * Stays exported: the outbound iCal export feed (`/api/ical/[token]`) needs
 * the underlying booking ids, not just an availability answer. Anything that
 * only needs "is this range free" / "which days are booked" should use
 * `isRangeAvailable` / `getBookedDays` below instead.
 */
export async function getDirectBookings(
  deps: AvailabilityDeps = defaultDeps,
): Promise<{ id: string; startDate: string; endDate: string }[]> {
  await connection();
  const rows = await deps.store.listDirectBookings();

  const today = toUtcDayString(deps.clock());
  return rows
    .filter((row) => isActiveDirectBooking(row, today))
    .map(({ id, startDate, endDate }) => ({ id, startDate, endDate }));
}

/**
 * Returns all owner blocks — manual date blocks the owner set (issue #179).
 * Blocks have no lifecycle, so there's nothing to filter: every row counts.
 *
 * Stays exported for the same reason as `getDirectBookings`: the outbound
 * iCal export feed (`/api/ical/[token]`) needs the underlying block ids to
 * build stable VEVENT UIDs, not just an availability answer.
 */
export async function getOwnerBlocks(
  deps: AvailabilityDeps = defaultDeps,
): Promise<{ id: string; startDate: string; endDate: string }[]> {
  await connection();
  return deps.store.listOwnerBlocks();
}

/**
 * Returns the merged busy intervals from all enabled iCal sources plus live
 * DB holds and owner blocks. A block only ever ADDS busyness, so wiring it in
 * here automatically covers every consumer of this seam — the public
 * calendar's disabled days (`getBookedDays`), the submit-time re-check
 * (`isRangeAvailable` in book/action.ts), and the admin confirm guard
 * (lifecycle.ts) — with no caller changes.
 *
 * Stale sources (>5 minutes) are lazily re-fetched; failures retain
 * last-known-good intervals (ADR-0005). A never-synced source that fails
 * contributes no intervals (fail-open).
 *
 * Part of the module's public interface alongside `isRangeAvailable` /
 * `getBookedDays` — exported primarily so the lazy-refresh glue (staleness,
 * write-back, fail-open) can be unit-tested directly through it via injected
 * `AvailabilityDeps`, without recomputing the merge through the higher-level
 * functions. Callers outside this module should still prefer
 * `isRangeAvailable` / `getBookedDays`, the two operations the rest of the
 * app actually needs.
 */
export async function getBusyIntervals(
  deps: AvailabilityDeps = defaultDeps,
): Promise<BusyInterval[]> {
  const [sources, holds, blocks] = await Promise.all([
    deps.store.listEnabledIcalSources(),
    getDirectBookings(deps),
    getOwnerBlocks(deps),
  ]);

  const intervals: BusyInterval[] = [...holds, ...blocks].map((i) => ({
    start: i.startDate,
    end: i.endDate,
  }));

  const sourceIntervals = await Promise.all(
    sources.map((source) => refreshSourceIfStale(source, deps)),
  );

  for (const si of sourceIntervals) {
    intervals.push(...si);
  }

  return intervals;
}

/**
 * Ensures every enabled iCal source's cache is fresh (≤5 minutes), re-fetching
 * stale ones and writing the result back through the store — the same lazy
 * refresh `getBusyIntervals` performs, exposed as a bare side effect.
 *
 * For callers that read `ical_source` rows directly because they need columns
 * the availability store doesn't carry (the admin dashboard: name, lastError):
 * await this first, then select — the rows then reflect the same freshness
 * guarantee the booking form gets.
 */
export async function refreshIcalSourcesIfStale(
  deps: AvailabilityDeps = defaultDeps,
): Promise<void> {
  const sources = await deps.store.listEnabledIcalSources();
  await Promise.all(
    sources.map((source) => refreshSourceIfStale(source, deps)),
  );
}

/**
 * The single availability seam: "is this date range free?" — merges iCal
 * intervals with live DB holds and checks for a conflict in one call, so
 * callers (booking form submission, admin confirm guard) don't have to fetch
 * busy intervals and run `hasConflict` themselves.
 */
export async function isRangeAvailable(
  start: string,
  end: string,
  deps: AvailabilityDeps = defaultDeps,
): Promise<boolean> {
  const busyIntervals = await getBusyIntervals(deps);
  return !hasConflict(busyIntervals, start, end);
}

/**
 * The other half of the availability seam: "which days are booked?" —
 * expands the merged busy intervals into a deduplicated list of date strings
 * for the booking calendar's disabled-dates.
 */
export async function getBookedDays(
  deps: AvailabilityDeps = defaultDeps,
): Promise<string[]> {
  const busyIntervals = await getBusyIntervals(deps);
  return [...new Set(busyIntervals.flatMap(expandInterval))];
}
