import { describe, it, expect } from "vitest";
import { inclusiveRangeToInterval } from "./owner-blocks";

describe("inclusiveRangeToInterval", () => {
  it("turns a same-day selection into a one-day block (exclusive end = day + 1)", () => {
    expect(inclusiveRangeToInterval("2026-07-10", "2026-07-10")).toEqual({
      start: "2026-07-10",
      end: "2026-07-11",
    });
  });

  it("blocks both clicked days: 10–13 inclusive → [10, 14)", () => {
    expect(inclusiveRangeToInterval("2026-07-10", "2026-07-13")).toEqual({
      start: "2026-07-10",
      end: "2026-07-14",
    });
  });

  it("normalizes reversed click order", () => {
    expect(inclusiveRangeToInterval("2026-07-13", "2026-07-10")).toEqual({
      start: "2026-07-10",
      end: "2026-07-14",
    });
  });

  it("crosses a month boundary", () => {
    // Last blocked day is Jul 31 → exclusive end rolls to Aug 1.
    expect(inclusiveRangeToInterval("2026-07-28", "2026-07-31")).toEqual({
      start: "2026-07-28",
      end: "2026-08-01",
    });
  });

  it("crosses a year boundary", () => {
    // Last blocked day is Dec 31 → exclusive end rolls to Jan 1 next year.
    expect(inclusiveRangeToInterval("2026-12-30", "2026-12-31")).toEqual({
      start: "2026-12-30",
      end: "2027-01-01",
    });
  });
});
