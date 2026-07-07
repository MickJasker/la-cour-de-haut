import { isActiveDirectBooking } from "./availability-utils";
import { toUtcDayString } from "./calendar-day";
import type { BookingRow, IcalSourceRow } from "./dashboard";

/**
 * The booking statuses that occupy dates on the admin occupancy calendar —
 * the same "active" set that blocks availability (ADR-0004 / ADR-0021): a
 * hold that has expired no longer occupies; a `deposit_paid` booking always
 * does (a missed balance deadline never releases dates).
 */
const OCCUPYING_STATUSES = ["on_hold", "deposit_paid", "confirmed"] as const;

export type OccupyingBookingStatus = (typeof OCCUPYING_STATUSES)[number];

export type OccupancyEntry =
  | {
      kind: "booking";
      id: string;
      name: string;
      status: OccupyingBookingStatus;
      start: string;
      end: string;
    }
  | {
      kind: "ical";
      sourceName: string;
      start: string;
      end: string;
    };

function toOccupyingStatus(status: string): OccupyingBookingStatus | null {
  return (OCCUPYING_STATUSES as readonly string[]).includes(status)
    ? (status as OccupyingBookingStatus)
    : null;
}

/**
 * Turns the dashboard's raw rows into the flat list of things that occupy
 * dates: active direct bookings (on_hold non-expired + deposit_paid +
 * confirmed, via the shared `isActiveDirectBooking` predicate so this can't
 * drift from the busy-interval logic) and every cached interval of every
 * enabled iCal source.
 */
export function computeOccupancyEntries(
  bookings: BookingRow[],
  icalSources: IcalSourceRow[],
  today: string,
): OccupancyEntry[] {
  const bookingEntries = bookings.flatMap((b): OccupancyEntry[] => {
    const status = toOccupyingStatus(b.status);
    if (status === null || !isActiveDirectBooking(b, today)) return [];
    return [
      {
        kind: "booking",
        id: b.id,
        name: b.name,
        status,
        start: b.startDate,
        end: b.endDate,
      },
    ];
  });

  const icalEntries = icalSources.flatMap((source) =>
    (source.cachedIntervals ?? []).map((interval): OccupancyEntry => ({
      kind: "ical",
      sourceName: source.name,
      start: interval.start,
      end: interval.end,
    })),
  );

  return [...bookingEntries, ...icalEntries];
}

/** One rendered slice of an entry on a single day cell. */
export type DaySegment = {
  /** Stable React key, shared by every day slice of the same entry. */
  key: string;
  entry: OccupancyEntry;
  /** This day is the entry's first occupied day. */
  isStart: boolean;
  /** This day is the entry's last occupied day (`end` is exclusive, RFC 5545). */
  isEnd: boolean;
  /** Render the label here: on the start day and on each Monday continuation. */
  showLabel: boolean;
};

export type DayCell = {
  date: string; // YYYY-MM-DD
  inMonth: boolean;
  segments: DaySegment[];
};

/** Shifts a YYYY-MM month string by `delta` months, across year boundaries. */
export function addMonths(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return toUtcDayString(shifted).slice(0, 7);
}

function entryKey(entry: OccupancyEntry): string {
  return entry.kind === "booking"
    ? `booking-${entry.id}`
    : `ical-${entry.sourceName}-${entry.start}-${entry.end}`;
}

/** The day after `date`, as a YYYY-MM-DD string. */
function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return toUtcDayString(d);
}

/**
 * Lays out a YYYY-MM month as Monday-start weeks, padded with out-of-month
 * days to complete the first and last week, and projects the occupancy
 * entries onto each day. An entry covers a day when `start <= day < end` —
 * the same exclusive-end convention as `expandInterval` / `hasConflict`.
 */
export function buildCalendarMonth(
  month: string,
  entries: OccupancyEntry[],
): DayCell[][] {
  // A fixed stacking order (by start date, then key) keeps an entry in the
  // same visual row across all its days and weeks.
  const sorted = [...entries].sort(
    (a, b) =>
      a.start.localeCompare(b.start) || entryKey(a).localeCompare(entryKey(b)),
  );

  const firstOfMonth = new Date(`${month}-01T00:00:00Z`);
  // Monday-start weekday index: Mon=0 … Sun=6.
  const leadingDays = (firstOfMonth.getUTCDay() + 6) % 7;

  const cursor = new Date(firstOfMonth);
  cursor.setUTCDate(cursor.getUTCDate() - leadingDays);

  const weeks: DayCell[][] = [];
  do {
    const week: DayCell[] = [];
    for (let weekday = 0; weekday < 7; weekday++) {
      const date = toUtcDayString(cursor);
      week.push({
        date,
        inMonth: date.startsWith(month),
        segments: sorted
          .filter((entry) => entry.start <= date && date < entry.end)
          .map((entry) => {
            const isStart = date === entry.start;
            return {
              key: entryKey(entry),
              entry,
              isStart,
              isEnd: nextDay(date) === entry.end,
              // Repeat the label at the start of each week so multi-week
              // spans stay identifiable without scrolling back.
              showLabel: isStart || weekday === 0,
            };
          }),
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(week);
  } while (toUtcDayString(cursor).startsWith(month));

  return weeks;
}
