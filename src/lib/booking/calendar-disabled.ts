/**
 * Half-day role model for the public availability calendar (issue #183).
 *
 * All busy intervals are end-exclusive (RFC 5545) and `getBookedDays()`
 * returns the busy NIGHTS as `yyyy-MM-dd` strings — for a booking 13 → 15
 * August it returns the 13th and 14th only. A calendar day therefore has two
 * independent half-day roles:
 *
 * - blocked as CHECK-IN when the night starting that day is busy
 * - blocked as CHECK-OUT when the preceding night is busy
 *
 * A changeover day (wisseldag: its own night busy, preceding night free) is
 * selectable as check-out only — a guest departing that morning leaves before
 * the next guests arrive, matching the server-side `hasConflict` semantics
 * which already accept a stay ending on another booking's start day.
 *
 * Everything here is pure and string-based (lexicographic comparison of
 * `yyyy-MM-dd` is date order), so there are no timezone pitfalls to test
 * around and the component wiring stays a one-liner.
 */

/**
 * Whether `day` is blocked in the CHECK-IN role: the night starting that day
 * is busy.
 */
export function isArrivalBlocked(
  bookedNights: ReadonlySet<string>,
  day: string,
): boolean {
  return bookedNights.has(day);
}

/**
 * Whether `day` is blocked in the CHECK-OUT role for a stay arriving on
 * `pendingFrom`. A valid departure must be strictly after the arrival and
 * every night in [pendingFrom, day) must be free — this both blocks days
 * whose preceding night is busy and prevents ranges spanning a fully-booked
 * day, independently of react-day-picker's `excludeDisabled` reset.
 */
export function isDepartureBlocked(
  bookedNights: ReadonlySet<string>,
  day: string,
  pendingFrom: string,
): boolean {
  if (day <= pendingFrom) return true;
  for (const night of bookedNights) {
    if (pendingFrom <= night && night < day) return true;
  }
  return false;
}

/**
 * Derives the arrival day awaiting a departure pick from the current range
 * selection, or undefined when the next click picks an arrival.
 *
 * react-day-picker v10 range mode (with the default `min` of 0) reports the
 * first click as `{from: d, to: d}`, so a single-day "range" means the guest
 * just picked an arrival. Once a full range is selected the next click
 * restarts or reshapes the range, so it's treated as an arrival pick again.
 * Empty strings mean unset (the booking form's field-state convention).
 */
export function pendingArrival(
  from: string | undefined,
  to: string | undefined,
): string | undefined {
  if (!from) return undefined;
  if (!to || to === from) return from;
  return undefined;
}

/**
 * The selection-state-aware `disabled` matcher for the booking calendar:
 * arrival semantics when no arrival is pending, departure semantics while one
 * is.
 *
 * The pending arrival day itself must stay ENABLED: react-day-picker's
 * `excludeDisabled` runs the disabled matcher over a completed range
 * including its own `from` day, so reporting it disabled would reset every
 * completion. Clicking it again simply clears the selection.
 */
export function isCalendarDayDisabled(
  bookedNights: ReadonlySet<string>,
  day: string,
  pendingFrom: string | undefined,
): boolean {
  if (!pendingFrom) return isArrivalBlocked(bookedNights, day);
  if (day === pendingFrom) return false;
  return isDepartureBlocked(bookedNights, day, pendingFrom);
}
