import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

// Mocks for the DB-backed public interface tests further down (isRangeAvailable /
// getBookedDays). `availability-utils.ts` (imported below for the pure-function
// tests) is deliberately left unmocked, so `availability.ts`'s real logic —
// including the real hasConflict/expandInterval/isActiveDirectBooking — runs
// against the fake DB rows configured per test.
vi.mock("@/db", () => ({ getDb: vi.fn() }));
vi.mock("@/db/schema", () => ({
  icalSource: { __table: "icalSource" },
  bookingRequest: { __table: "bookingRequest" },
}));
vi.mock("drizzle-orm", () => ({ eq: vi.fn(), inArray: vi.fn() }));
vi.mock("next/server", () => ({
  connection: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./ical-cache", () => ({ refreshSourceIfStale: vi.fn() }));

import {
  expandInterval,
  hasConflict,
  isActiveDirectBooking,
} from "./availability-utils";
import type { BusyInterval } from "@/db/schema";
import { icalSource, bookingRequest } from "@/db/schema";
import { getDb } from "@/db";
import { refreshSourceIfStale } from "./ical-cache";
import { isRangeAvailable, getBookedDays } from "./availability";

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

describe("isActiveDirectBooking — busy-intervals consumes the shared isExpiredHold predicate", () => {
  const TODAY = "2026-06-30";
  const YESTERDAY = "2026-06-29";

  it("a confirmed booking always counts as active, regardless of deadline", () => {
    expect(
      isActiveDirectBooking(
        { status: "confirmed", paymentDeadline: YESTERDAY },
        TODAY,
      ),
    ).toBe(true);
  });

  it("an on_hold booking with deadline yesterday is no longer active (expired)", () => {
    expect(
      isActiveDirectBooking(
        { status: "on_hold", paymentDeadline: YESTERDAY },
        TODAY,
      ),
    ).toBe(false);
  });

  it("an on_hold booking with deadline exactly today is still active (boundary)", () => {
    expect(
      isActiveDirectBooking(
        { status: "on_hold", paymentDeadline: TODAY },
        TODAY,
      ),
    ).toBe(true);
  });

  it("an on_hold booking with no deadline yet is still active", () => {
    expect(
      isActiveDirectBooking(
        { status: "on_hold", paymentDeadline: null },
        TODAY,
      ),
    ).toBe(true);
  });

  it("a requested booking never counts as active (doesn't block dates yet)", () => {
    expect(
      isActiveDirectBooking(
        { status: "requested", paymentDeadline: null },
        TODAY,
      ),
    ).toBe(false);
  });
});

describe("isRangeAvailable / getBookedDays — the public availability interface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (refreshSourceIfStale as Mock).mockImplementation(
      async (source: { cachedIntervals?: BusyInterval[] }) =>
        source.cachedIntervals ?? [],
    );
  });

  function mockDb({
    bookingRows = [],
    sourceRows = [],
  }: {
    bookingRows?: unknown[];
    sourceRows?: unknown[];
  }) {
    const from = vi.fn((table: unknown) => {
      if (table === bookingRequest) {
        return { where: vi.fn().mockResolvedValue(bookingRows) };
      }
      if (table === icalSource) {
        return { where: vi.fn().mockResolvedValue(sourceRows) };
      }
      return { where: vi.fn().mockResolvedValue([]) };
    });
    (getDb as Mock).mockReturnValue({
      select: vi.fn().mockReturnValue({ from }),
    });
  }

  it("a range with no busy intervals is available", async () => {
    mockDb({});
    await expect(isRangeAvailable("2027-01-01", "2027-01-05")).resolves.toBe(
      true,
    );
  });

  it("a range overlapping an active on_hold booking is unavailable", async () => {
    mockDb({
      bookingRows: [
        {
          id: "b1",
          startDate: "2027-01-01",
          endDate: "2027-01-05",
          status: "on_hold",
          paymentDeadline: "2099-01-01",
        },
      ],
    });
    await expect(isRangeAvailable("2027-01-02", "2027-01-03")).resolves.toBe(
      false,
    );
  });

  it("a range overlapping an iCal-sourced busy interval is unavailable", async () => {
    mockDb({
      sourceRows: [
        {
          id: "s1",
          cachedIntervals: [{ start: "2027-04-01", end: "2027-04-05" }],
        },
      ],
    });
    await expect(isRangeAvailable("2027-04-02", "2027-04-03")).resolves.toBe(
      false,
    );
  });

  it("an expired hold frees its dates — the range becomes available again", async () => {
    mockDb({
      bookingRows: [
        {
          id: "b1",
          startDate: "2027-01-01",
          endDate: "2027-01-05",
          status: "on_hold",
          paymentDeadline: "2000-01-01", // long past
        },
      ],
    });
    await expect(isRangeAvailable("2027-01-02", "2027-01-03")).resolves.toBe(
      true,
    );
  });

  it("getBookedDays expands and dedupes busy intervals from bookings and iCal sources", async () => {
    mockDb({
      bookingRows: [
        {
          id: "b1",
          startDate: "2027-02-01",
          endDate: "2027-02-03",
          status: "confirmed",
          paymentDeadline: null,
        },
      ],
      sourceRows: [
        {
          id: "s1",
          cachedIntervals: [{ start: "2027-02-02", end: "2027-02-04" }],
        },
      ],
    });
    const days = await getBookedDays();
    expect([...days].sort()).toEqual([
      "2027-02-01",
      "2027-02-02",
      "2027-02-03",
    ]);
  });

  it("getBookedDays excludes dates freed by an expired hold", async () => {
    mockDb({
      bookingRows: [
        {
          id: "b1",
          startDate: "2027-03-01",
          endDate: "2027-03-05",
          status: "on_hold",
          paymentDeadline: "2000-01-01",
        },
      ],
    });
    await expect(getBookedDays()).resolves.toEqual([]);
  });
});
