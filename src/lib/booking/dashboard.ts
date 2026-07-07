import { isExpiredHold } from "./machine";

export type BookingRow = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  guestCount: number;
  status: string;
  paymentDeadline: string | null;
  // The balance (incl. borg) deadline of a two-stage booking (ADR-0021).
  // Null for collapsed and legacy bookings; drives deposit_paid overdue /
  // approaching categorisation below.
  balanceDeadline: string | null;
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
  const in3Days = new Date(new Date(today).getTime() + 3 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  return {
    newRequests: bookings.filter((b) => b.status === "requested"),
    // Overdue = an on_hold whose deposit deadline passed (ADR-0004, same
    // predicate as busy-intervals and display status), OR a deposit_paid
    // whose balance deadline passed (ADR-0021). The latter never releases
    // dates automatically — it only surfaces here for the owner to chase.
    overdue: bookings.filter(
      (b) =>
        isExpiredHold(b, today) ||
        (b.status === "deposit_paid" &&
          b.balanceDeadline !== null &&
          b.balanceDeadline < today),
    ),
    // Approaching = an on_hold whose deposit deadline is within 3 days, OR a
    // deposit_paid whose balance deadline is within 3 days (and not already
    // overdue). Boundary matches isExpiredHold: a deadline of exactly today is
    // approaching, not overdue.
    approaching: bookings.filter((b) => {
      if (b.status === "on_hold") {
        if (b.paymentDeadline === null) return false;
        if (isExpiredHold(b, today)) return false;
        return b.paymentDeadline <= in3Days;
      }
      if (b.status === "deposit_paid") {
        if (b.balanceDeadline === null) return false;
        return b.balanceDeadline >= today && b.balanceDeadline <= in3Days;
      }
      return false;
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
