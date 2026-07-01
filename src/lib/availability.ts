import "server-only";
import { getDb } from "@/db";
import { icalSource } from "@/db/schema";
import { bookingRequest, type BusyInterval } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { connection } from "next/server";
import { refreshSourceIfStale } from "./ical-cache";
import {
  expandInterval,
  hasConflict,
  isActiveDirectBooking,
} from "./availability-utils";

export type { BusyInterval };

/**
 * Returns all on_hold (non-expired) and confirmed direct bookings.
 * This is the single canonical filter for which bookings count as busy.
 *
 * Fetches both statuses from the DB, then filters with the shared
 * `isActiveDirectBooking` predicate (ADR-0004) instead of re-encoding the
 * expiry comparison in SQL — keeps this in lockstep with display status and
 * dashboard categorisation, which apply the same predicate.
 *
 * Stays exported: the outbound iCal export feed (`/api/ical/[token]`) needs
 * the underlying booking ids, not just an availability answer. Anything that
 * only needs "is this range free" / "which days are booked" should use
 * `isRangeAvailable` / `getBookedDays` below instead.
 */
export async function getDirectBookings(): Promise<
  { id: string; startDate: string; endDate: string }[]
> {
  await connection();
  const db = getDb();
  const rows = await db
    .select({
      id: bookingRequest.id,
      startDate: bookingRequest.startDate,
      endDate: bookingRequest.endDate,
      status: bookingRequest.status,
      paymentDeadline: bookingRequest.paymentDeadline,
    })
    .from(bookingRequest)
    .where(inArray(bookingRequest.status, ["on_hold", "confirmed"]));

  const today = new Date().toISOString().slice(0, 10);
  return rows
    .filter((row) => isActiveDirectBooking(row, today))
    .map(({ id, startDate, endDate }) => ({ id, startDate, endDate }));
}

/**
 * Returns the merged busy intervals from all enabled iCal sources plus live DB holds.
 * Stale sources (>~1 hour) are lazily re-fetched; failures retain last-known-good
 * intervals (ADR-0005). A never-synced source that fails contributes no intervals
 * (fail-open).
 *
 * Internal implementation detail of this module — callers outside should use
 * `isRangeAvailable` / `getBookedDays`, the two operations the rest of the
 * app actually needs instead of recombining busy intervals themselves.
 */
async function getBusyIntervals(): Promise<BusyInterval[]> {
  const db = getDb();

  const [sources, holds] = await Promise.all([
    db.select().from(icalSource).where(eq(icalSource.enabled, true)),
    getDirectBookings(),
  ]);

  const intervals: BusyInterval[] = holds.map((h) => ({
    start: h.startDate,
    end: h.endDate,
  }));

  const sourceIntervals = await Promise.all(
    sources.map((source) => refreshSourceIfStale(source)),
  );

  for (const si of sourceIntervals) {
    intervals.push(...si);
  }

  return intervals;
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
): Promise<boolean> {
  const busyIntervals = await getBusyIntervals();
  return !hasConflict(busyIntervals, start, end);
}

/**
 * The other half of the availability seam: "which days are booked?" —
 * expands the merged busy intervals into a deduplicated list of date strings
 * for the booking calendar's disabled-dates.
 */
export async function getBookedDays(): Promise<string[]> {
  const busyIntervals = await getBusyIntervals();
  return [...new Set(busyIntervals.flatMap(expandInterval))];
}
