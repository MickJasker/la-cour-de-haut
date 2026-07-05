import { isExpiredHold } from "./machine";

export type BookingRow = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  guestCount: number;
  status: string;
  paymentDeadline: string | null;
};

export type IcalSourceRow = {
  id: string;
  name: string;
  lastError: string | null;
  lastErrorAt: Date | null;
  cachedIntervals: { start: string; end: string }[] | null;
};

export type UpcomingEntry =
  | {
      type: "booking";
      startDate: string;
      endDate: string;
      name: string;
      guestCount: number;
    }
  | {
      type: "ical";
      startDate: string;
      endDate: string;
      sourceName: string;
    };

export type DashboardData = {
  newRequests: BookingRow[];
  overdue: BookingRow[];
  approaching: BookingRow[];
  brokenFeeds: IcalSourceRow[];
  upcoming: UpcomingEntry[];
};

export function computeDashboard(
  bookings: BookingRow[],
  icalSources: IcalSourceRow[],
  today: string,
): DashboardData {
  return {
    newRequests: bookings.filter((b) => b.status === "requested"),
    // ADR-0004: a hold is "overdue" the moment it's expired — same predicate
    // used by busy-intervals and display status, so this can't drift.
    overdue: bookings.filter((b) => isExpiredHold(b, today)),
    approaching: bookings.filter((b) => {
      if (b.status !== "on_hold" || b.paymentDeadline === null) return false;
      if (isExpiredHold(b, today)) return false;
      const in3Days = new Date(new Date(today).getTime() + 3 * 86_400_000)
        .toISOString()
        .slice(0, 10);
      return b.paymentDeadline <= in3Days;
    }),
    brokenFeeds: icalSources.filter((f) => f.lastError !== null),
    upcoming: [
      ...bookings
        .filter((b) => b.status === "confirmed" && b.endDate >= today)
        .map((b): UpcomingEntry => ({
          type: "booking",
          startDate: b.startDate,
          endDate: b.endDate,
          name: b.name,
          guestCount: b.guestCount,
        })),
      ...icalSources.flatMap((source) =>
        (source.cachedIntervals ?? [])
          .filter((interval) => interval.end >= today)
          .map((interval): UpcomingEntry => ({
            type: "ical",
            startDate: interval.start,
            endDate: interval.end,
            sourceName: source.name,
          })),
      ),
    ].sort((a, b) => a.startDate.localeCompare(b.startDate)),
  };
}
