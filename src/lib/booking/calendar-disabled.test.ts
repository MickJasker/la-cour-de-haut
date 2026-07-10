import { describe, it, expect } from "vitest";
import {
  isArrivalBlocked,
  isDepartureBlocked,
  isCalendarDayDisabled,
  pendingArrival,
} from "./calendar-disabled";

// An existing booking 15 → 17 August: busy NIGHTS are the 15th and 16th
// (end-exclusive, RFC 5545). The 15th is a changeover day when the night of
// the 14th is free.
const bookingStarting15th = new Set(["2026-08-15", "2026-08-16"]);

// An existing booking 10 → 13 August: busy nights 10, 11, 12. The 13th is
// its checkout day (night of the 13th is free).
const bookingEnding13th = new Set(["2026-08-10", "2026-08-11", "2026-08-12"]);

describe("isArrivalBlocked", () => {
  it("blocks the first day of an existing booking as an arrival (its night is busy)", () => {
    expect(isArrivalBlocked(bookingStarting15th, "2026-08-15")).toBe(true);
  });

  it("blocks a day inside an existing booking", () => {
    expect(isArrivalBlocked(bookingEnding13th, "2026-08-11")).toBe(true);
  });

  it("keeps an existing booking's checkout day selectable as an arrival (no regression)", () => {
    expect(isArrivalBlocked(bookingEnding13th, "2026-08-13")).toBe(false);
  });

  it("keeps a fully free day selectable as an arrival", () => {
    expect(isArrivalBlocked(bookingStarting15th, "2026-08-13")).toBe(false);
  });
});

describe("isDepartureBlocked", () => {
  it("allows the 13 → 15 August stay: departure on the changeover day another booking starts on", () => {
    expect(
      isDepartureBlocked(bookingStarting15th, "2026-08-15", "2026-08-13"),
    ).toBe(false);
  });

  it("blocks a day inside an existing booking as a departure (preceding night busy)", () => {
    expect(
      isDepartureBlocked(bookingEnding13th, "2026-08-11", "2026-08-08"),
    ).toBe(true);
  });

  it("blocks any departure whose stay would span busy nights", () => {
    expect(
      isDepartureBlocked(bookingEnding13th, "2026-08-20", "2026-08-08"),
    ).toBe(true);
    // Even one day past the changeover day spans the busy night of the 15th.
    expect(
      isDepartureBlocked(bookingStarting15th, "2026-08-16", "2026-08-13"),
    ).toBe(true);
  });

  it("blocks a departure equal to the pending arrival (zero-night stay)", () => {
    expect(
      isDepartureBlocked(bookingStarting15th, "2026-08-13", "2026-08-13"),
    ).toBe(true);
  });

  it("blocks a departure before the pending arrival", () => {
    expect(
      isDepartureBlocked(bookingStarting15th, "2026-08-12", "2026-08-13"),
    ).toBe(true);
  });

  it("allows a one-night stay departing the day after arrival when that night is free", () => {
    expect(
      isDepartureBlocked(bookingStarting15th, "2026-08-14", "2026-08-13"),
    ).toBe(false);
  });

  it("allows a back-to-back turnaround: arrive on one booking's checkout day, depart on the next booking's start day", () => {
    const both = new Set([...bookingEnding13th, ...bookingStarting15th]);
    // Arrival 13 August (checkout day of the first booking) …
    expect(isArrivalBlocked(both, "2026-08-13")).toBe(false);
    // … departing 15 August (start day of the second booking): nights 13 and
    // 14 are free, so the stay fits exactly in the gap.
    expect(isDepartureBlocked(both, "2026-08-15", "2026-08-13")).toBe(false);
  });

  it("blocks nothing after the arrival when no nights are booked", () => {
    expect(isDepartureBlocked(new Set(), "2026-09-01", "2026-08-13")).toBe(
      false,
    );
  });
});

describe("pendingArrival", () => {
  it("is undefined with no selection (next click picks an arrival)", () => {
    expect(pendingArrival("", "")).toBeUndefined();
    expect(pendingArrival(undefined, undefined)).toBeUndefined();
  });

  it("is the from day while the departure is still unpicked", () => {
    expect(pendingArrival("2026-08-13", "")).toBe("2026-08-13");
  });

  it("treats react-day-picker's single-day first click ({from: d, to: d}) as a pending arrival", () => {
    expect(pendingArrival("2026-08-13", "2026-08-13")).toBe("2026-08-13");
  });

  it("is undefined once a full range is selected (next click restarts with an arrival)", () => {
    expect(pendingArrival("2026-08-13", "2026-08-15")).toBeUndefined();
  });
});

describe("isCalendarDayDisabled", () => {
  it("uses arrival semantics when nothing is selected", () => {
    expect(
      isCalendarDayDisabled(bookingStarting15th, "2026-08-15", "", ""),
    ).toBe(true);
    expect(
      isCalendarDayDisabled(bookingStarting15th, "2026-08-13", "", ""),
    ).toBe(false);
  });

  it("uses departure semantics while an arrival is pending: the changeover day becomes selectable", () => {
    expect(
      isCalendarDayDisabled(
        bookingStarting15th,
        "2026-08-15",
        "2026-08-13",
        "",
      ),
    ).toBe(false);
  });

  it("treats react-day-picker's single-day first click ({from: d, to: d}) as a pending arrival", () => {
    expect(
      isCalendarDayDisabled(
        bookingStarting15th,
        "2026-08-15",
        "2026-08-13",
        "2026-08-13",
      ),
    ).toBe(false);
  });

  it("keeps a day inside a booking disabled in both roles", () => {
    expect(isCalendarDayDisabled(bookingEnding13th, "2026-08-11", "", "")).toBe(
      true,
    );
    expect(
      isCalendarDayDisabled(bookingEnding13th, "2026-08-11", "2026-08-08", ""),
    ).toBe(true);
  });

  it("blocks days before the pending arrival", () => {
    expect(
      isCalendarDayDisabled(
        bookingStarting15th,
        "2026-08-12",
        "2026-08-13",
        "",
      ),
    ).toBe(true);
  });

  it("keeps the pending arrival day itself enabled so excludeDisabled does not reset every completed range", () => {
    // react-day-picker's excludeDisabled check runs the disabled matcher over
    // the completed range INCLUDING its own `from` day. If the pending
    // arrival day reported itself disabled, every completion would reset.
    // Clicking it again simply clears the selection.
    expect(
      isCalendarDayDisabled(
        bookingStarting15th,
        "2026-08-13",
        "2026-08-13",
        "2026-08-13",
      ),
    ).toBe(false);
  });

  it("keeps a completed range's changeover departure day enabled (not greyed/aria-disabled)", () => {
    // After the range 13 → 15 completes, the matcher reverts to arrival
    // semantics under which the 15th (busy night) is disabled — but the day
    // the guest just picked must not render as unavailable.
    expect(
      isCalendarDayDisabled(
        bookingStarting15th,
        "2026-08-15",
        "2026-08-13",
        "2026-08-15",
      ),
    ).toBe(false);
    expect(
      isCalendarDayDisabled(
        bookingStarting15th,
        "2026-08-13",
        "2026-08-13",
        "2026-08-15",
      ),
    ).toBe(false);
  });

  it("keeps other busy days disabled while a full range is selected", () => {
    expect(
      isCalendarDayDisabled(
        bookingStarting15th,
        "2026-08-16",
        "2026-08-13",
        "2026-08-15",
      ),
    ).toBe(true);
  });
});
