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
});
