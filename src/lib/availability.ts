import "server-only";
import ical, { type VEvent } from "node-ical";
import { z } from "zod";
import { getDb } from "@/db";
import { icalSource } from "@/db/schema";
import { bookingRequest, type BusyInterval } from "@/db/schema";
import { and, eq, gte, isNull, or } from "drizzle-orm";
import { connection } from "next/server";

export type { BusyInterval };
export { expandInterval } from "./availability-utils";

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

const busyIntervalSchema = z.array(
  z.object({ start: z.string(), end: z.string() }),
);

async function refreshSource(
  source: typeof icalSource.$inferSelect,
): Promise<BusyInterval[]> {
  const response = await fetch(source.url, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  const data = ical.sync.parseICS(text);

  const toDateString = (d: Date): string => {
    // Normalize to a UTC calendar date string to avoid server-timezone/DST shifts.
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  };

  const intervals: BusyInterval[] = [];
  for (const component of Object.values(data)) {
    if (!component || component.type !== "VEVENT") continue;
    const event = component as VEvent;
    if (event.status === "CANCELLED") continue;
    if (!event.start || !event.end) continue;

    intervals.push({
      start: toDateString(event.start),
      // DTEND is exclusive per RFC 5545; stored as-is (callers expand [start, end))
      end: toDateString(event.end),
    });
  }

  return intervals;
}

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
 * Stale sources (>1 h) are lazily re-fetched; failures retain last-known-good intervals.
 * A never-synced source that fails contributes no intervals (fail-open).
 */
export async function getBusyIntervals(): Promise<BusyInterval[]> {
  await connection();
  const db = getDb();

  const [sources, holds] = await Promise.all([
    db.select().from(icalSource).where(eq(icalSource.enabled, true)),
    getDirectBookings(),
  ]);

  const intervals: BusyInterval[] = holds.map((h) => ({
    start: h.startDate,
    end: h.endDate,
  }));

  await Promise.all(
    sources.map(async (source) => {
      const isStale =
        !source.lastSyncedAt ||
        Date.now() - source.lastSyncedAt.getTime() > REFRESH_INTERVAL_MS;

      if (!isStale) {
        const parsed = busyIntervalSchema.safeParse(source.cachedIntervals);
        if (parsed.success) intervals.push(...parsed.data);
        return;
      }

      try {
        const fresh = await refreshSource(source);
        await db
          .update(icalSource)
          .set({
            cachedIntervals: fresh,
            lastSyncedAt: new Date(),
            lastError: null,
            lastErrorAt: null,
          })
          .where(eq(icalSource.id, source.id));
        intervals.push(...fresh);
      } catch (err) {
        await db
          .update(icalSource)
          .set({
            lastError: err instanceof Error ? err.message : String(err),
            lastErrorAt: new Date(),
          })
          .where(eq(icalSource.id, source.id));
        // Retain last-known-good intervals
        const parsed = busyIntervalSchema.safeParse(source.cachedIntervals);
        if (parsed.success) intervals.push(...parsed.data);
      }
    }),
  );

  return intervals;
}
