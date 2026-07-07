import { describe, it, expect, vi } from "vitest";
import { fetchIcalFeed } from "./ical-fetch";

// Minimal valid iCal with one VEVENT — use UTC noon datetimes so getUTC* is unambiguous
const ICAL_ONE_EVENT = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
DTSTART:20250801T120000Z
DTEND:20250808T120000Z
SUMMARY:Test booking
UID:test-uid-1@example.com
END:VEVENT
END:VCALENDAR`;

// iCal with a CANCELLED event
const ICAL_WITH_CANCELLED = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
DTSTART:20250801T120000Z
DTEND:20250808T120000Z
SUMMARY:Active booking
STATUS:CONFIRMED
UID:test-uid-2@example.com
END:VEVENT
BEGIN:VEVENT
DTSTART:20250810T120000Z
DTEND:20250815T120000Z
SUMMARY:Cancelled booking
STATUS:CANCELLED
UID:test-uid-3@example.com
END:VEVENT
END:VCALENDAR`;

// iCal with multiple events
const ICAL_TWO_EVENTS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
DTSTART:20250601T120000Z
DTEND:20250608T120000Z
SUMMARY:June booking
UID:test-uid-4@example.com
END:VEVENT
BEGIN:VEVENT
DTSTART:20250901T120000Z
DTEND:20250907T120000Z
SUMMARY:September booking
UID:test-uid-5@example.com
END:VEVENT
END:VCALENDAR`;

// Recurring weekly block, no exceptions — three occurrences via RRULE COUNT
const ICAL_RECURRING_BASIC = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
DTSTART:20250801T120000Z
DTEND:20250804T120000Z
SUMMARY:Weekly cleaning block
UID:test-recurring-basic@example.com
RRULE:FREQ=WEEKLY;COUNT=3
END:VEVENT
END:VCALENDAR`;

// Recurring weekly block (5 occurrences) with an EXDATE dropping one occurrence
// and a RECURRENCE-ID override shifting another occurrence's dates.
const ICAL_RECURRING_WITH_OVERRIDES = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
DTSTART:20250801T120000Z
DTEND:20250804T120000Z
SUMMARY:Weekly cleaning block
UID:test-recurring-overrides@example.com
RRULE:FREQ=WEEKLY;COUNT=5
EXDATE:20250815T120000Z
END:VEVENT
BEGIN:VEVENT
DTSTART:20250823T120000Z
DTEND:20250826T120000Z
SUMMARY:Weekly cleaning block (rescheduled)
UID:test-recurring-overrides@example.com
RECURRENCE-ID:20250822T120000Z
END:VEVENT
END:VCALENDAR`;

// Recurring weekly block (3 occurrences) where one occurrence is cancelled via
// a RECURRENCE-ID override carrying STATUS:CANCELLED — the series continues,
// only that single instance drops out.
const ICAL_RECURRING_WITH_CANCELLED_OVERRIDE = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
DTSTART:20250901T120000Z
DTEND:20250903T120000Z
SUMMARY:Monthly maintenance block
UID:test-recurring-cancelled@example.com
RRULE:FREQ=WEEKLY;COUNT=3
END:VEVENT
BEGIN:VEVENT
DTSTART:20250908T120000Z
DTEND:20250910T120000Z
SUMMARY:Monthly maintenance block
UID:test-recurring-cancelled@example.com
RECURRENCE-ID:20250908T120000Z
STATUS:CANCELLED
END:VEVENT
END:VCALENDAR`;

// Unbounded RRULE (no COUNT/UNTIL) — must not be expanded to infinity
const ICAL_RECURRING_UNBOUNDED = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
DTSTART:20250101T100000Z
DTEND:20250102T100000Z
SUMMARY:Nightly block
UID:test-recurring-unbounded@example.com
RRULE:FREQ=DAILY
END:VEVENT
END:VCALENDAR`;

// A recurring series alongside an unrelated one-off event, to confirm both
// expansion and non-recurring handling work together in the same feed.
const ICAL_RECURRING_AND_ONEOFF = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
DTSTART:20250801T120000Z
DTEND:20250804T120000Z
SUMMARY:Weekly cleaning block
UID:test-recurring-mixed@example.com
RRULE:FREQ=WEEKLY;COUNT=2
END:VEVENT
BEGIN:VEVENT
DTSTART:20250601T120000Z
DTEND:20250608T120000Z
SUMMARY:One-off booking
UID:test-oneoff-mixed@example.com
END:VEVENT
END:VCALENDAR`;

// Airbnb-shaped feed: a real booking (SUMMARY:Reserved) plus an
// "Airbnb (Not Available)" block — the summary Airbnb gives both manual
// blocks and dates it re-exports after importing our other calendars
// (Natuurhuisje, our own export feed). Only the reservation may be imported.
const ICAL_AIRBNB_REEXPORT = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Airbnb Inc//Hosting Calendar 1.0//EN
BEGIN:VEVENT
DTSTART:20260704T120000Z
DTEND:20260707T120000Z
SUMMARY:Reserved
UID:airbnb-reservation-1@airbnb.com
END:VEVENT
BEGIN:VEVENT
DTSTART:20260711T120000Z
DTEND:20260714T120000Z
SUMMARY:Airbnb (Not Available)
UID:airbnb-block-1@airbnb.com
END:VEVENT
END:VCALENDAR`;

function makeFetch(body: string, status = 200): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  } as Response);
}

describe("fetchIcalFeed", () => {
  it("returns ok:true with parsed intervals for a valid feed", async () => {
    const result = await fetchIcalFeed(
      "https://example.com/feed.ics",
      makeFetch(ICAL_ONE_EVENT),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.intervals).toHaveLength(1);
    expect(result.intervals[0]).toMatchObject({
      start: "2025-08-01",
      end: "2025-08-08",
    });
  });

  it("skips CANCELLED events", async () => {
    const result = await fetchIcalFeed(
      "https://example.com/feed.ics",
      makeFetch(ICAL_WITH_CANCELLED),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.intervals).toHaveLength(1);
    expect(result.intervals[0].start).toBe("2025-08-01");
  });

  it('skips Airbnb "Not Available" blocks but keeps Reserved bookings', async () => {
    const result = await fetchIcalFeed(
      "https://example.com/feed.ics",
      makeFetch(ICAL_AIRBNB_REEXPORT),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.intervals).toEqual([
      { start: "2026-07-04", end: "2026-07-07" },
    ]);
  });

  it("returns all events from a multi-event feed", async () => {
    const result = await fetchIcalFeed(
      "https://example.com/feed.ics",
      makeFetch(ICAL_TWO_EVENTS),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.intervals).toHaveLength(2);
  });

  it("returns ok:false with an error message on HTTP error", async () => {
    const result = await fetchIcalFeed(
      "https://example.com/feed.ics",
      makeFetch("Not Found", 404),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("HTTP 404");
  });

  it("returns ok:false when fetch throws (network error)", async () => {
    const brokenFetch = vi.fn().mockRejectedValue(new Error("Network failure"));
    const result = await fetchIcalFeed(
      "https://example.com/feed.ics",
      brokenFetch as unknown as typeof fetch,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("Network failure");
  });

  it("returns ok:true with empty intervals for an empty calendar", async () => {
    const emptyIcal = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Test//EN\nEND:VCALENDAR`;
    const result = await fetchIcalFeed(
      "https://example.com/feed.ics",
      makeFetch(emptyIcal),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.intervals).toHaveLength(0);
  });

  it("normalises dates to UTC calendar strings (YYYY-MM-DD)", async () => {
    const result = await fetchIcalFeed(
      "https://example.com/feed.ics",
      makeFetch(ICAL_ONE_EVENT),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Both start and end should match YYYY-MM-DD pattern
    expect(result.intervals[0].start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.intervals[0].end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  describe("recurring (RRULE) events", () => {
    it("expands a recurring RRULE event into one busy interval per occurrence", async () => {
      const now = new Date("2025-07-25T00:00:00Z");
      const result = await fetchIcalFeed(
        "https://example.com/feed.ics",
        makeFetch(ICAL_RECURRING_BASIC),
        now,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.intervals).toHaveLength(3);
      expect(result.intervals).toEqual(
        expect.arrayContaining([
          { start: "2025-08-01", end: "2025-08-04" },
          { start: "2025-08-08", end: "2025-08-11" },
          { start: "2025-08-15", end: "2025-08-18" },
        ]),
      );
    });

    it("respects EXDATE exclusions and RECURRENCE-ID date overrides", async () => {
      const now = new Date("2025-07-25T00:00:00Z");
      const result = await fetchIcalFeed(
        "https://example.com/feed.ics",
        makeFetch(ICAL_RECURRING_WITH_OVERRIDES),
        now,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // 5 occurrences - 1 EXDATE = 4; the Aug 22 occurrence is replaced (not
      // duplicated) by its RECURRENCE-ID override dated Aug 23-26.
      expect(result.intervals).toHaveLength(4);
      expect(result.intervals).toEqual(
        expect.arrayContaining([
          { start: "2025-08-01", end: "2025-08-04" },
          { start: "2025-08-08", end: "2025-08-11" },
          { start: "2025-08-23", end: "2025-08-26" },
          { start: "2025-08-29", end: "2025-09-01" },
        ]),
      );
      // The excluded date and the base (pre-override) occurrence must not appear
      expect(result.intervals).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ start: "2025-08-15" }),
        ]),
      );
      expect(result.intervals).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ start: "2025-08-22" }),
        ]),
      );
    });

    it("drops a single occurrence cancelled via a RECURRENCE-ID override without affecting the rest of the series", async () => {
      const now = new Date("2025-08-25T00:00:00Z");
      const result = await fetchIcalFeed(
        "https://example.com/feed.ics",
        makeFetch(ICAL_RECURRING_WITH_CANCELLED_OVERRIDE),
        now,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.intervals).toHaveLength(2);
      expect(result.intervals).toEqual(
        expect.arrayContaining([
          { start: "2025-09-01", end: "2025-09-03" },
          { start: "2025-09-15", end: "2025-09-17" },
        ]),
      );
      expect(result.intervals).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ start: "2025-09-08" }),
        ]),
      );
    });

    it("bounds expansion of an unbounded RRULE to the sync window instead of expanding indefinitely", async () => {
      const now = new Date("2025-01-01T00:00:00Z");
      const result = await fetchIcalFeed(
        "https://example.com/feed.ics",
        makeFetch(ICAL_RECURRING_UNBOUNDED),
        now,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // ~12 months of nightly occurrences — bounded, never unbounded
      expect(result.intervals.length).toBeGreaterThan(300);
      expect(result.intervals.length).toBeLessThan(400);
      const maxStart = result.intervals.reduce(
        (max, interval) => (interval.start > max ? interval.start : max),
        "",
      );
      expect(maxStart <= "2026-01-02").toBe(true);
    });

    it("expands a recurring series alongside an unrelated one-off event in the same feed", async () => {
      const now = new Date("2025-07-25T00:00:00Z");
      const result = await fetchIcalFeed(
        "https://example.com/feed.ics",
        makeFetch(ICAL_RECURRING_AND_ONEOFF),
        now,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.intervals).toHaveLength(3);
      expect(result.intervals).toEqual(
        expect.arrayContaining([
          { start: "2025-08-01", end: "2025-08-04" },
          { start: "2025-08-08", end: "2025-08-11" },
          { start: "2025-06-01", end: "2025-06-08" },
        ]),
      );
    });
  });
});
