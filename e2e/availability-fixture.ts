import { expandInterval } from "../src/lib/booking/availability-utils";

function toDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

const now = new Date();

// Keep the test interval safely inside the booking window (now + 1 day .. +12 months).
const blockedStartDate = addDays(now, 40);
const blockedEndExclusiveDate = addDays(blockedStartDate, 4);

export const blockedRange = {
  start: toDateString(blockedStartDate),
  endExclusive: toDateString(blockedEndExclusiveDate),
};

// Reuse the same day-expansion logic the app uses (src/lib/availability-utils)
// instead of re-deriving the list of blocked dates here.
export const blockedDates = expandInterval({
  start: blockedRange.start,
  end: blockedRange.endExclusive,
});

export const checkoutDate = toDateString(addDays(blockedStartDate, 4));
