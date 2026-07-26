import { cacheLife, cacheTag } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { icalExportToken } from "@/db/schema";
import { CACHE_TAGS } from "@/lib/cache-tags";
import {
  readDirectBookings,
  readOwnerBlocks,
} from "@/lib/booking/availability";

/**
 * Serializable result of a cache fill: `found` drives the 404-vs-200 split in
 * the handler, `body` carries the `.ics` payload on a hit. Unknown tokens
 * return `{ found: false }` from *inside* the cache (negative caching,
 * ADR-0024) so a revoked platform polling its dead URL never wakes the DB.
 */
type FeedResult = { found: boolean; body?: string };

/**
 * The `"use cache: remote"` seam for the export feed (ADR-0024, amended). The
 * directive cannot sit in a route-handler body, so it lives here; the handler
 * just wraps the result in a Response.
 *
 * Plain `"use cache"` stores entries in-memory per Lambda instance: polls
 * arrive minutes apart, so each one almost always lands on a cold instance
 * with an empty cache, and the DB got hit on every single poll despite the
 * directive. `: remote` backs the same cacheTag/cacheLife/updateTag API with
 * Vercel's Runtime Cache, which is shared across instances, so this is the
 * only variant that actually delivers the zero-DB-touch cache hit.
 *
 * Everything with a database cost lives inside this function, so a cache hit
 * touches the DB zero times and Neon actually sleeps: the token lookup, the
 * `lastAccessedAt` health write, and the bookings/blocks reads. `connection()`
 * is illegal here, so the reads go through the `connection()`-free
 * `readDirectBookings` / `readOwnerBlocks` seam.
 */
async function buildFeed(token: string): Promise<FeedResult> {
  "use cache: remote";
  // `hours` = 1-hour server revalidate: the backstop for time-driven
  // transitions no mutation announces (lazy hold expiry, bookings aging into
  // the past). Event-driven changes invalidate immediately via updateTag.
  cacheLife("hours");
  cacheTag(CACHE_TAGS.icalExport);

  const db = getDb();
  const [row] = await db
    .select({ id: icalExportToken.id })
    .from(icalExportToken)
    .where(eq(icalExportToken.token, token));

  if (!row) {
    return { found: false };
  }

  // The ADR-0007 health signal, amended by ADR-0024: its meaning changes from
  // "last poll" to "last origin fetch". It's awaited (not fire-and-forget) and
  // lives inside the cached function on purpose — it runs at cache-fill time
  // only, so it's frozen while the cache is warm and bumped when a poll reaches
  // the origin.
  await db
    .update(icalExportToken)
    .set({ lastAccessedAt: new Date() })
    .where(eq(icalExportToken.id, row.id));

  const [bookings, blocks] = await Promise.all([
    readDirectBookings(),
    readOwnerBlocks(),
  ]);

  // RFC 5545 §3.3.5 — basic date-time stamp: YYYYMMDDTHHmmssZ. This reflects
  // cache-fill time, not serve time — cosmetically stale, semantically fine
  // (platforms key on UID).
  const dtstamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

  const toDate = (s: string) => s.replace(/-/g, "");

  const bookingVevents = bookings.map((b) =>
    [
      "BEGIN:VEVENT",
      `UID:booking-${b.id}@lacourdehaut.fr`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${toDate(b.startDate)}`,
      `DTEND;VALUE=DATE:${toDate(b.endDate)}`,
      "SUMMARY:Booked",
      "END:VEVENT",
    ].join("\r\n"),
  );

  // The private `label` is never exported. `SUMMARY:Not available` is
  // deliberate: it matches the inbound echo filter (/not available|blokkade/i
  // in ical-fetch.ts), so a verbatim re-export by a future platform can never
  // re-import as a block — self-filtering by construction.
  const blockVevents = blocks.map((b) =>
    [
      "BEGIN:VEVENT",
      `UID:block-${b.id}@lacourdehaut.fr`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${toDate(b.startDate)}`,
      `DTEND;VALUE=DATE:${toDate(b.endDate)}`,
      "SUMMARY:Not available",
      "END:VEVENT",
    ].join("\r\n"),
  );

  const vevents = [...bookingVevents, ...blockVevents];

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//La Cour de Haut//Booking Feed//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...vevents,
    "END:VCALENDAR",
  ].join("\r\n");

  return { found: true, body: ics };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token: rawToken } = await params;
  const token = rawToken.replace(/\.ics$/, "");

  const result = await buildFeed(token);

  if (!result.found) {
    return new Response("Not found", { status: 404 });
  }

  // `no-store` toward platforms is deliberate: the cache is ours (the
  // `"use cache"` layer), and letting platform HTTP caches stack on top would
  // add uncontrolled staleness (ADR-0024).
  return new Response(result.body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
