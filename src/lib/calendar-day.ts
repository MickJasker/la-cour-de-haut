/**
 * Formats a Date as its UTC calendar-day string (YYYY-MM-DD).
 *
 * Equivalent to `date.toISOString().slice(0, 10)` and to the hand-rolled
 * `getUTCFullYear()`-based pad formatters it replaces — this is the single
 * place that encodes the UTC-day convention used everywhere a date is
 * compared or formatted in the availability/booking area. Deliberately has
 * no `server-only` import so it can be shared by server modules (booking
 * machine, availability, iCal fetch) and client components (confirm dialog)
 * alike.
 *
 * @param date - Defaults to the real current time; pass a fixed Date in
 * tests for deterministic output.
 */
export function toUtcDayString(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/**
 * How far forward the booking flow looks. The booking calendar's last
 * selectable month (`endMonth` in `book-form.tsx`) and the recurring iCal
 * expansion window (`ical-fetch.ts`) both read this constant instead of
 * being coupled only by a comment — the app never offers or blocks dates
 * beyond this horizon.
 */
export const FORWARD_HORIZON_MONTHS = 12;
