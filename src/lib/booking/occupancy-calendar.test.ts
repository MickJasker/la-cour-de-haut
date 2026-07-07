import { describe, it, expect } from "vitest";
import {
  addMonths,
  buildCalendarMonth,
  computeOccupancyEntries,
} from "./occupancy-calendar";
import type { BookingRow, IcalSourceRow } from "./dashboard";

const TODAY = "2026-07-07";

function booking(overrides: Partial<BookingRow>): BookingRow {
  return {
    id: "b1",
    name: "Emma Leclerc",
    startDate: "2026-07-10",
    endDate: "2026-07-15",
    guestCount: 2,
    status: "confirmed",
    paymentDeadline: null,
    balanceDeadline: null,
    ...overrides,
  };
}

function icalSource(overrides: Partial<IcalSourceRow>): IcalSourceRow {
  return {
    id: "s1",
    name: "Airbnb",
    lastError: null,
    lastErrorAt: null,
    cachedIntervals: [{ start: "2026-07-20", end: "2026-07-24" }],
    ...overrides,
  };
}

describe("computeOccupancyEntries", () => {
  it("includes confirmed bookings as occupying entries", () => {
    const entries = computeOccupancyEntries(
      [booking({ id: "b1", status: "confirmed" })],
      [],
      TODAY,
    );
    expect(entries).toEqual([
      {
        kind: "booking",
        id: "b1",
        name: "Emma Leclerc",
        status: "confirmed",
        start: "2026-07-10",
        end: "2026-07-15",
      },
    ]);
  });

  it("includes non-expired on_hold bookings", () => {
    const entries = computeOccupancyEntries(
      [booking({ id: "b2", status: "on_hold", paymentDeadline: "2026-07-09" })],
      [],
      TODAY,
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: "booking", status: "on_hold" });
  });

  it("includes deposit_paid bookings, even past their balance deadline (ADR-0021: dates stay blocked)", () => {
    const entries = computeOccupancyEntries(
      [
        booking({
          id: "b7",
          status: "deposit_paid",
          paymentDeadline: "2026-07-01", // deposit deadline long gone — irrelevant
          balanceDeadline: "2026-07-05", // overdue balance never releases dates
        }),
      ],
      [],
      TODAY,
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      kind: "booking",
      id: "b7",
      status: "deposit_paid",
      start: "2026-07-10",
      end: "2026-07-15",
    });
  });

  it("excludes expired holds (ADR-0004: deadline passed means not occupying)", () => {
    const entries = computeOccupancyEntries(
      [booking({ id: "b3", status: "on_hold", paymentDeadline: "2026-07-06" })],
      [],
      TODAY,
    );
    expect(entries).toEqual([]);
  });

  it("excludes requested, declined and cancelled bookings", () => {
    const entries = computeOccupancyEntries(
      [
        booking({ id: "b4", status: "requested" }),
        booking({ id: "b5", status: "declined" }),
        booking({ id: "b6", status: "cancelled" }),
      ],
      [],
      TODAY,
    );
    expect(entries).toEqual([]);
  });

  it("flattens iCal source intervals into entries labeled with the source name", () => {
    const entries = computeOccupancyEntries(
      [],
      [
        icalSource({
          name: "Natuurhuisje",
          cachedIntervals: [
            { start: "2026-07-01", end: "2026-07-04" },
            { start: "2026-08-01", end: "2026-08-05" },
          ],
        }),
      ],
      TODAY,
    );
    expect(entries).toEqual([
      {
        kind: "ical",
        sourceName: "Natuurhuisje",
        start: "2026-07-01",
        end: "2026-07-04",
      },
      {
        kind: "ical",
        sourceName: "Natuurhuisje",
        start: "2026-08-01",
        end: "2026-08-05",
      },
    ]);
  });

  it("treats a source with null cachedIntervals as contributing nothing", () => {
    const entries = computeOccupancyEntries(
      [],
      [icalSource({ cachedIntervals: null })],
      TODAY,
    );
    expect(entries).toEqual([]);
  });
});

describe("addMonths", () => {
  it("moves forward within a year", () => {
    expect(addMonths("2026-07", 1)).toBe("2026-08");
  });

  it("crosses a year boundary forward", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
  });

  it("crosses a year boundary backward", () => {
    expect(addMonths("2026-01", -1)).toBe("2025-12");
  });
});

describe("buildCalendarMonth", () => {
  it("lays out July 2026 as Monday-start weeks padded with out-of-month days", () => {
    const weeks = buildCalendarMonth("2026-07", []);

    // July 2026: the 1st is a Wednesday, the 31st a Friday → 5 weeks.
    expect(weeks).toHaveLength(5);
    for (const week of weeks) expect(week).toHaveLength(7);

    // First week starts Monday June 29 with two out-of-month days.
    expect(weeks[0].map((d) => d.date)).toEqual([
      "2026-06-29",
      "2026-06-30",
      "2026-07-01",
      "2026-07-02",
      "2026-07-03",
      "2026-07-04",
      "2026-07-05",
    ]);
    expect(weeks[0].map((d) => d.inMonth)).toEqual([
      false,
      false,
      true,
      true,
      true,
      true,
      true,
    ]);

    // Last week ends Sunday August 2.
    expect(weeks[4][6]).toMatchObject({ date: "2026-08-02", inMonth: false });
  });

  it("handles a leap-year February", () => {
    const weeks = buildCalendarMonth("2028-02", []);
    const days = weeks.flat().filter((d) => d.inMonth);
    expect(days).toHaveLength(29);
    expect(days[0].date).toBe("2028-02-01");
    expect(days[28].date).toBe("2028-02-29");
  });

  it("projects an entry onto every day it covers, with an exclusive end", () => {
    const entry = {
      kind: "booking",
      id: "b1",
      name: "Emma Leclerc",
      status: "confirmed",
      start: "2026-07-10",
      end: "2026-07-13",
    } as const;
    const weeks = buildCalendarMonth("2026-07", [entry]);
    const byDate = new Map(weeks.flat().map((d) => [d.date, d]));

    expect(byDate.get("2026-07-09")!.segments).toEqual([]);
    // 2026-07-13 is the exclusive end → last occupied day is the 12th.
    expect(byDate.get("2026-07-13")!.segments).toEqual([]);

    const start = byDate.get("2026-07-10")!.segments[0];
    expect(start).toMatchObject({ isStart: true, isEnd: false });
    const middle = byDate.get("2026-07-11")!.segments[0];
    expect(middle).toMatchObject({ isStart: false, isEnd: false });
    const last = byDate.get("2026-07-12")!.segments[0];
    expect(last).toMatchObject({ isStart: false, isEnd: true });

    // All slices of the same entry share a stable key.
    expect(new Set([start.key, middle.key, last.key]).size).toBe(1);
  });

  it("shows the label on the start day and again on each Monday continuation", () => {
    // 2026-07-16 (Thu) → 2026-07-22 (exclusive), so it crosses the week
    // boundary at Monday 2026-07-20.
    const entry = {
      kind: "ical",
      sourceName: "Airbnb",
      start: "2026-07-16",
      end: "2026-07-22",
    } as const;
    const weeks = buildCalendarMonth("2026-07", [entry]);
    const byDate = new Map(weeks.flat().map((d) => [d.date, d]));

    expect(byDate.get("2026-07-16")!.segments[0].showLabel).toBe(true);
    expect(byDate.get("2026-07-17")!.segments[0].showLabel).toBe(false);
    expect(byDate.get("2026-07-20")!.segments[0].showLabel).toBe(true);
    expect(byDate.get("2026-07-21")!.segments[0].showLabel).toBe(false);
  });

  it("stacks overlapping entries in a stable order (by start date) on every day", () => {
    const early = {
      kind: "booking",
      id: "b1",
      name: "Early",
      status: "on_hold",
      start: "2026-07-05",
      end: "2026-07-12",
    } as const;
    const late = {
      kind: "ical",
      sourceName: "Airbnb",
      start: "2026-07-08",
      end: "2026-07-14",
    } as const;
    // Pass them in reverse order to prove sorting is applied.
    const weeks = buildCalendarMonth("2026-07", [late, early]);
    const byDate = new Map(weeks.flat().map((d) => [d.date, d]));

    for (const date of ["2026-07-08", "2026-07-10", "2026-07-11"]) {
      const kinds = byDate.get(date)!.segments.map((s) => s.entry.kind);
      expect(kinds).toEqual(["booking", "ical"]);
    }
  });

  it("starts and ends exactly on week boundaries when the month does", () => {
    // June 2026: the 1st is a Monday and the 30th... is a Tuesday, so pick
    // February 2027: Feb 1 2027 is a Monday, Feb 28 a Sunday → exactly 4 weeks.
    const weeks = buildCalendarMonth("2027-02", []);
    expect(weeks).toHaveLength(4);
    expect(weeks[0][0]).toMatchObject({ date: "2027-02-01", inMonth: true });
    expect(weeks[3][6]).toMatchObject({ date: "2027-02-28", inMonth: true });
  });
});
