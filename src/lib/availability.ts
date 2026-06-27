import "server-only";
import { getDb } from "@/db";
import { icalSource } from "@/db/schema";
import { bookingRequest, type BusyInterval } from "@/db/schema";
import { and, eq, gte, isNull, or } from "drizzle-orm";
import { connection } from "next/server";
import { refreshSourceIfStale } from "./ical-cache";

export type { BusyInterval };
export { expandInterval } from "./availability-utils";

/**
 * Returns all on_hold (non-expired) and confirmed direct bookings.
 * This is the single canonical filter for which bookings count as busy.
 */
export async function getDirectBookings(): Promise<
  { id: string; startDate: string; endDate: string }[]
> {
  await connection();
  const db = getDb();
  return db
    .select({
      id: bookingRequest.id,
      startDate: bookingRequest.startDate,
      endDate: bookingRequest.endDate,
    })
    .from(bookingRequest)
    .where(
      or(
        // on_hold only counts while the payment deadline hasn't passed
        and(
          eq(bookingRequest.status, "on_hold"),
          or(
            isNull(bookingRequest.paymentDeadline),
            gte(
              bookingRequest.paymentDeadline,
              new Date().toISOString().slice(0, 10),
            ),
          ),
        ),
        eq(bookingRequest.status, "confirmed"),
      ),
    );
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
