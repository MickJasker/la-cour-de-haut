import { describe, it, expect } from "vitest";
import { expandInterval } from "./availability-utils";
import type { BusyInterval } from "@/db/schema";

function expandIntervals(intervals: BusyInterval[]): string[] {
  return [...new Set(intervals.flatMap(expandInterval))].sort();
}

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
