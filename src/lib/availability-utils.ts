import type { BusyInterval } from "@/db/schema";

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
    dates.push(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`,
    );
  }
  return dates;
}
