import "server-only";
import ical, { type VEvent } from "node-ical";
import type { BusyInterval } from "@/db/schema";

export type IcalFetchResult =
  | { ok: true; intervals: BusyInterval[] }
  | { ok: false; error: string };

/**
 * Fetches and parses an iCal feed from the given URL.
 * Pure function — no DB access, no cache writes.
 * Returns a typed result so callers can handle errors without throwing.
 */
export async function fetchIcalFeed(
  url: string,
  fetchFn: typeof fetch = fetch,
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

  const toDateString = (d: Date): string =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

  try {
    const data = ical.sync.parseICS(text);
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

    return { ok: true, intervals };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
