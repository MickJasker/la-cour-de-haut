import "server-only";
import { getDb } from "@/db";
import { icalSource } from "@/db/schema";
import { bookingRequest, type BusyInterval } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { connection } from "next/server";
import { refreshSourceIfStale } from "./ical-cache";
import { isActiveDirectBooking } from "./availability-utils";

export type { BusyInterval };
export { expandInterval } from "./availability-utils";

/**
 * Returns all on_hold (non-expired) and confirmed direct bookings.
 * This is the single canonical filter for which bookings count as busy.
 *
 * Fetches both statuses from the DB, then filters with the shared
 * `isActiveDirectBooking` predicate (ADR-0004) instead of re-encoding the
 * expiry comparison in SQL — keeps this in lockstep with display status and
 * dashboard categorisation, which apply the same predicate.
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
 * Stale sources (>5 min) are lazily re-fetched; failures retain last-known-good intervals.
 * A never-synced source that fails contributes no intervals (fail-open).
 */
export async function getBusyIntervals(): Promise<BusyInterval[]> {
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
