import type { BusyInterval } from "@/db/schema";
import { isExpiredHold } from "./machine";
import { toUtcDayString } from "./calendar-day";

/**
 * A direct booking blocks dates while it's confirmed, deposit_paid, or on_hold
 * and not yet past its (deposit) payment deadline (ADR-0004 / ADR-0021).
 * `deposit_paid` is treated like `confirmed` here: the deposit already secures
 * the dates, and a missed balance deadline never auto-releases them (it only
 * surfaces in the owner's overdue list). Built on the shared `isExpiredHold`
 * predicate so the busy-intervals query can't drift from display status or
 * dashboard categorisation.
 */
export function isActiveDirectBooking(
  booking: { status: string; paymentDeadline: string | null },
  today: string,
): boolean {
  return (
    booking.status === "confirmed" ||
    booking.status === "deposit_paid" ||
    (booking.status === "on_hold" && !isExpiredHold(booking, today))
  );
}

/**
 * Returns true if [start, end) overlaps any interval in the list.
 * DTEND is exclusive (RFC 5545), matching the convention in the rest of the codebase.
 */
export function hasConflict(
  intervals: BusyInterval[],
  start: string,
  end: string,
): boolean {
  return intervals.some((i) => start < i.end && i.start < end);
}

export function expandInterval({ start, end }: BusyInterval): string[] {
  const dates: string[] = [];
  // Use UTC to avoid DST shifts producing duplicate or missing dates
  for (
    let d = new Date(start + "T00:00:00Z");
    d < new Date(end + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    dates.push(toUtcDayString(d));
  }
  return dates;
}
