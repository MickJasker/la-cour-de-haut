import { describe, it, expect } from "vitest";
import { expandInterval, hasConflict } from "./availability-utils";
import type { BusyInterval } from "@/db/schema";

function expandIntervals(intervals: BusyInterval[]): string[] {
  return [...new Set(intervals.flatMap(expandInterval))].sort();
}

describe("hasConflict", () => {
  it("returns false for an empty interval list", () => {
    expect(hasConflict([], "2025-08-01", "2025-08-07")).toBe(false);
  });

  it("returns false when the booking range does not overlap any interval", () => {
    const intervals = [{ start: "2025-08-01", end: "2025-08-07" }];
    expect(hasConflict(intervals, "2025-08-10", "2025-08-14")).toBe(false);
  });

  it("returns false when booking checkout equals interval start (DTEND exclusive)", () => {
    const intervals = [{ start: "2025-08-10", end: "2025-08-17" }];
    // booking checks out on 2025-08-10 — same day a new block starts
    expect(hasConflict(intervals, "2025-08-05", "2025-08-10")).toBe(false);
  });

  it("returns false when booking start equals interval end (DTEND exclusive)", () => {
    const intervals = [{ start: "2025-08-01", end: "2025-08-08" }];
    // previous block ends on 2025-08-08 — booking starts that same day
    expect(hasConflict(intervals, "2025-08-08", "2025-08-15")).toBe(false);
  });

  it("returns true when booking partially overlaps an interval from the left", () => {
    const intervals = [{ start: "2025-08-05", end: "2025-08-12" }];
    expect(hasConflict(intervals, "2025-08-01", "2025-08-07")).toBe(true);
  });

  it("returns true when booking partially overlaps an interval from the right", () => {
    const intervals = [{ start: "2025-08-01", end: "2025-08-08" }];
    expect(hasConflict(intervals, "2025-08-05", "2025-08-12")).toBe(true);
  });

  it("returns true when booking is fully contained within an interval", () => {
    const intervals = [{ start: "2025-08-01", end: "2025-08-31" }];
    expect(hasConflict(intervals, "2025-08-10", "2025-08-17")).toBe(true);
  });

  it("returns true when booking fully contains an interval", () => {
    const intervals = [{ start: "2025-08-05", end: "2025-08-10" }];
    expect(hasConflict(intervals, "2025-08-01", "2025-08-15")).toBe(true);
  });

  it("returns true when booking matches interval exactly", () => {
    const intervals = [{ start: "2025-08-01", end: "2025-08-08" }];
    expect(hasConflict(intervals, "2025-08-01", "2025-08-08")).toBe(true);
  });

  it("returns true when any one of multiple intervals conflicts", () => {
    const intervals = [
      { start: "2025-07-01", end: "2025-07-07" },
      { start: "2025-08-10", end: "2025-08-17" },
    ];
    expect(hasConflict(intervals, "2025-08-12", "2025-08-20")).toBe(true);
  });
});

describe("expandInterval", () => {
  it("expands a single-night interval to one date", () => {
    expect(
      expandIntervals([{ start: "2025-07-10", end: "2025-07-11" }]),
    ).toEqual(["2025-07-10"]);
  });

  it("treats DTEND as exclusive — checkout day is not blocked", () => {
    const dates = expandIntervals([{ start: "2025-07-10", end: "2025-07-13" }]);
    expect(dates).toEqual(["2025-07-10", "2025-07-11", "2025-07-12"]);
    expect(dates).not.toContain("2025-07-13");
  });

  it("merges overlapping intervals without duplicates", () => {
    const dates = expandIntervals([
      { start: "2025-08-01", end: "2025-08-05" },
      { start: "2025-08-03", end: "2025-08-07" },
    ]);
    expect(dates).toEqual([
      "2025-08-01",
      "2025-08-02",
      "2025-08-03",
      "2025-08-04",
      "2025-08-05",
      "2025-08-06",
    ]);
  });

  it("merges disjoint intervals from multiple sources", () => {
    const dates = expandIntervals([
      { start: "2025-06-01", end: "2025-06-03" },
      { start: "2025-06-10", end: "2025-06-12" },
    ]);
    expect(dates).toEqual([
      "2025-06-01",
      "2025-06-02",
      "2025-06-10",
      "2025-06-11",
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(expandIntervals([])).toEqual([]);
  });

  it("handles a zero-duration interval (start === end) gracefully", () => {
    expect(
      expandIntervals([{ start: "2025-07-10", end: "2025-07-10" }]),
    ).toEqual([]);
  });
});
