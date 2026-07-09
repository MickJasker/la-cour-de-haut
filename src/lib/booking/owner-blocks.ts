import { toUtcDayString } from "./calendar-day";

/**
 * Converts a two-click INCLUSIVE day selection (both clicked days are blocked,
 * ADR-0022 decision 4) into the exclusive-end storage interval used everywhere
 * else (`expandInterval` / `hasConflict` / export): `end = last blocked day + 1`.
 *
 * The two clicks may arrive in either order, so the range is normalized first.
 * Date math is UTC-safe (like the `nextDay` helper in occupancy-calendar.ts) so
 * month/year boundaries don't drift.
 *
 * A same-day selection (both clicks on one day) yields a one-day block:
 * `{ start: day, end: day + 1 }`.
 */
export function inclusiveRangeToInterval(
  dayA: string,
  dayB: string,
): { start: string; end: string } {
  const start = dayA <= dayB ? dayA : dayB;
  const lastBlocked = dayA <= dayB ? dayB : dayA;
  const d = new Date(`${lastBlocked}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return { start, end: toUtcDayString(d) };
}
