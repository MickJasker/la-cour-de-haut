import "server-only";
import { z } from "zod";
import { getDb } from "@/db";
import { icalSource } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { BusyInterval } from "@/db/schema";
import { fetchIcalFeed } from "./ical-fetch";

// Matches the lazy-refresh threshold documented in CONTEXT.md and ADR-0005
// (DB-materialized lazy refresh) — a source is re-fetched on read once it's
// older than ~1 hour.
const REFRESH_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

const busyIntervalSchema = z.array(
  z.object({ start: z.string(), end: z.string() }),
);

/**
 * Checks whether the source's cache is stale (older than ~1 hour or never synced).
 * If stale, fetches fresh data and writes it back to the DB.
 * Returns the current intervals (fresh or last-known-good) for this source.
 */
export async function refreshSourceIfStale(
  source: typeof icalSource.$inferSelect,
): Promise<BusyInterval[]> {
  const db = getDb();

  const isStale =
    !source.lastSyncedAt ||
    Date.now() - source.lastSyncedAt.getTime() > REFRESH_INTERVAL_MS;

  if (!isStale) {
    const parsed = busyIntervalSchema.safeParse(source.cachedIntervals);
    return parsed.success ? parsed.data : [];
  }

  const result = await fetchIcalFeed(source.url);

  if (result.ok) {
    await db
      .update(icalSource)
      .set({
        cachedIntervals: result.intervals,
        lastSyncedAt: new Date(),
        lastError: null,
        lastErrorAt: null,
      })
      .where(eq(icalSource.id, source.id));
    return result.intervals;
  } else {
    await db
      .update(icalSource)
      .set({
        lastError: result.error,
        lastErrorAt: new Date(),
      })
      .where(eq(icalSource.id, source.id));
    // Retain last-known-good intervals
    const parsed = busyIntervalSchema.safeParse(source.cachedIntervals);
    return parsed.success ? parsed.data : [];
  }
}
