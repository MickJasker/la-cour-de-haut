import "server-only";
import { addMonths } from "date-fns";
import ical, { type VEvent } from "node-ical";
import type { BusyInterval } from "@/db/schema";
import { FORWARD_HORIZON_MONTHS, toUtcDayString } from "./calendar-day";

export type IcalFetchResult =
  { ok: true; intervals: BusyInterval[] } | { ok: false; error: string };

/**
 * How far forward to expand recurring (RRULE) events. RRULEs can be unbounded
 * (no COUNT/UNTIL), so expansion must be capped at a sync-time window rather than
 * materialized to infinity. Shares `FORWARD_HORIZON_MONTHS` with the booking
 * calendar's own forward horizon (`endMonth` in
 * src/components/sections/book-form.tsx) — the app never offers or blocks
 * dates beyond that horizon, so expanding a recurring source further would be
 * wasted work with no behavioral benefit.
 * (Concrete one-off VEVENTs — the only kind ADR-0005 originally anticipated — are
 * unaffected by this window; they're taken as-is regardless of date, same as before.)
 */
const RECURRING_EXPANSION_WINDOW_MONTHS = FORWARD_HORIZON_MONTHS;

/**
 * Airbnb's exported feed contains two kinds of VEVENTs: real Airbnb bookings
 * (`SUMMARY:Reserved`) and `SUMMARY:Airbnb (Not Available)` blocks. The blocks
 * include dates Airbnb itself imported from our *other* connected calendars
 * (Natuurhuisje, this site's own export feed), so importing them echoes every
 * external booking back as a second "Airbnb" interval. Skip them: any date
 * genuinely occupied is still busy via its originating feed or our own
 * bookings. Trade-off: dates blocked manually inside Airbnb are exported the
 * same way and are therefore ignored — manual blocks belong in this app, not
 * in Airbnb.
 */
const REEXPORTED_BLOCK_SUMMARY = /not available/i;

function isReexportedBlock(event: VEvent): boolean {
  const summary = event.summary;
  const text = typeof summary === "string" ? summary : (summary?.val ?? "");
  return REEXPORTED_BLOCK_SUMMARY.test(text);
}

/**
 * Fetches and parses an iCal feed from the given URL.
 * Pure function — no DB access, no cache writes.
 * Returns a typed result so callers can handle errors without throwing.
 *
 * @param now - Clock anchoring the RRULE expansion window (see
 * `RECURRING_EXPANSION_WINDOW_MONTHS`). Defaults to the real current time;
 * overridable for deterministic tests.
 */
export async function fetchIcalFeed(
  url: string,
  fetchFn: typeof fetch = fetch,
  now: Date = new Date(),
): Promise<IcalFetchResult> {
  let response: Response;
  try {
    response = await fetchFn(url, { cache: "no-store" });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  if (!response.ok) {
    return { ok: false, error: `HTTP ${response.status}` };
  }

  let text: string;
  try {
    text = await response.text();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  try {
    const data = ical.sync.parseICS(text);
    const intervals: BusyInterval[] = [];
    const windowFrom = now;
    const windowTo = addMonths(now, RECURRING_EXPANSION_WINDOW_MONTHS);

    for (const component of Object.values(data)) {
      if (!component || component.type !== "VEVENT") continue;
      const event = component as VEvent;

      if (event.rrule) {
        // Recurring event: materialize individual occurrences within the bounded
        // window. expandRecurringEvent applies EXDATE exclusions and
        // RECURRENCE-ID overrides for us (excludeExdates/includeOverrides both
        // default true), so a single call covers both without bespoke override
        // logic here. expandOngoing catches an occurrence already in progress
        // at `now` that started before the window but hasn't ended yet.
        const instances = ical.expandRecurringEvent(event, {
          from: windowFrom,
          to: windowTo,
          expandOngoing: true,
        });

        for (const instance of instances) {
          // A RECURRENCE-ID override can mark a single occurrence CANCELLED
          // (e.g. a deleted instance) without cancelling the whole series.
          if (instance.event.status === "CANCELLED") continue;
          // instance.event is the base VEVENT or its RECURRENCE-ID override,
          // so an override that rewrites the summary is judged on its own.
          if (isReexportedBlock(instance.event)) continue;

          intervals.push({
            start: toUtcDayString(instance.start),
            end: toUtcDayString(instance.end),
          });
        }
        continue;
      }

      if (event.status === "CANCELLED") continue;
      if (isReexportedBlock(event)) continue;
      if (!event.start || !event.end) continue;

      intervals.push({
        start: toUtcDayString(event.start),
        // DTEND is exclusive per RFC 5545; stored as-is (callers expand [start, end))
        end: toUtcDayString(event.end),
      });
    }

    return { ok: true, intervals };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
