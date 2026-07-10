/**
 * Availability semantics for the public booking calendar (issue #183).
 *
 * All busy intervals are end-exclusive (RFC 5545) and `getBookedDays()`
 * returns the busy NIGHTS as `yyyy-MM-dd` strings — for a booking 13 → 15
 * August it returns the 13th and 14th only. A calendar day has two
 * independent half-day roles: it can host a check-in (its own night must be
 * free) or a check-out (the preceding night must be free).
 *
 * The calendar only greys out days that can serve NEITHER role — days
 * interior to a booking. A changeover day (wisseldag: its own night busy,
 * preceding night free) always renders open, like every mainstream booking
 * calendar: a stay can end there, and a stay can never start there simply
 * because no valid departure exists after it. While a selection is pending,
 * a day is disabled only if the stay between it and the pending day would
 * span a busy night — in either direction, since react-day-picker extends a
 * range backwards when a day before the pending arrival is clicked.
 *
 * Everything here is pure and string-based (lexicographic comparison of
 * `yyyy-MM-dd` is date order), so there are no timezone pitfalls to test
 * around and the component wiring stays a one-liner.
 */

const DAY_MS = 86_400_000;

function previousDay(day: string): string {
  const d = new Date(day + "T00:00:00Z");
  return new Date(d.getTime() - DAY_MS).toISOString().slice(0, 10);
}

/**
 * Whether `day` is interior to a booking: both its own night and the
 * preceding night are busy, so it can be neither a check-in nor a check-out.
 */
export function isFullyBooked(
  bookedNights: ReadonlySet<string>,
  day: string,
): boolean {
  return bookedNights.has(day) && bookedNights.has(previousDay(day));
}

/**
 * Whether the stay between `dayA` and `dayB` (in either order) would span a
 * busy night. The nights slept are [earlier, later) — end-exclusive, so a
 * stay ending on another booking's start day does not conflict, matching the
 * server-side `hasConflict` semantics.
 */
export function isStayBlocked(
  bookedNights: ReadonlySet<string>,
  dayA: string,
  dayB: string,
): boolean {
  const [start, end] = dayA < dayB ? [dayA, dayB] : [dayB, dayA];
  for (const night of bookedNights) {
    if (start <= night && night < end) return true;
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
 * The selection-state-aware `disabled` matcher for the booking calendar.
 * Takes the raw range selection (empty string = unset) and derives the mode
 * internally: with no pending day, only interior days are disabled; with a
 * pending day, every day whose stay to/from it would span a busy night is.
 *
 * The pending day itself must stay ENABLED: react-day-picker's
 * `excludeDisabled` runs the disabled matcher over a completed range
 * including its own `from` day, so reporting it disabled would reset every
 * completion. Clicking it again simply clears the selection.
 */
export function isCalendarDayDisabled(
  bookedNights: ReadonlySet<string>,
  day: string,
  from: string | undefined,
  to: string | undefined,
): boolean {
  const pendingFrom = pendingArrival(from, to);
  if (pendingFrom) {
    if (day === pendingFrom) return false;
    return isStayBlocked(bookedNights, pendingFrom, day);
  }
  return isFullyBooked(bookedNights, day);
}
