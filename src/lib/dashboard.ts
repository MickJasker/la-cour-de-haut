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
};

export type DashboardData = {
  newRequests: BookingRow[];
  overdue: BookingRow[];
  approaching: BookingRow[];
  brokenFeeds: IcalSourceRow[];
  upcoming: BookingRow[];
};

export function computeDashboard(
  bookings: BookingRow[],
  icalSources: IcalSourceRow[],
  today: string,
): DashboardData {
  return {
    newRequests: bookings.filter((b) => b.status === "requested"),
    overdue: bookings.filter(
      (b) =>
        b.status === "on_hold" &&
        b.paymentDeadline !== null &&
        b.paymentDeadline < today,
    ),
    approaching: bookings.filter((b) => {
      if (b.status !== "on_hold" || b.paymentDeadline === null) return false;
      const in3Days = new Date(new Date(today).getTime() + 3 * 86_400_000)
        .toISOString()
        .slice(0, 10);
      return b.paymentDeadline >= today && b.paymentDeadline <= in3Days;
    }),
    brokenFeeds: icalSources.filter((f) => f.lastError !== null),
    upcoming: bookings
      .filter((b) => b.status === "confirmed" && b.startDate >= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate)),
  };
}
