import { describe, it, expect } from "vitest";
import {
  isFullyBooked,
  isStayBlocked,
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

describe("isFullyBooked", () => {
  it("keeps a changeover day open: the first day of a booking can still be a departure", () => {
    expect(isFullyBooked(bookingStarting15th, "2026-08-15")).toBe(false);
  });

  it("blocks a day inside a booking (neither check-in nor check-out possible)", () => {
    expect(isFullyBooked(bookingStarting15th, "2026-08-16")).toBe(true);
    expect(isFullyBooked(bookingEnding13th, "2026-08-11")).toBe(true);
  });

  it("keeps a booking's checkout day open (it can be a new arrival)", () => {
    expect(isFullyBooked(bookingEnding13th, "2026-08-13")).toBe(false);
  });

  it("blocks the seam of two back-to-back bookings (checkout day that is also an arrival day)", () => {
    const both = new Set([...bookingEnding13th, ...bookingStarting15th]);
    // 13 August: night 12 busy (first booking) — if night 13 were busy too it
    // would be interior. Here nights 13/14 are free, so it stays open …
    expect(isFullyBooked(both, "2026-08-13")).toBe(false);
    // … but with a booking 13 → 15 filling the gap, the 15th becomes interior.
    const gapFilled = new Set([...both, "2026-08-13", "2026-08-14"]);
    expect(isFullyBooked(gapFilled, "2026-08-15")).toBe(true);
  });

  it("keeps a fully free day open", () => {
    expect(isFullyBooked(bookingStarting15th, "2026-08-13")).toBe(false);
  });

  it("handles month boundaries when checking the preceding night", () => {
    // Busy night 31 July → 1 August is interior only if night 1 August is
    // also busy.
    const julyBlock = new Set(["2026-07-31"]);
    expect(isFullyBooked(julyBlock, "2026-08-01")).toBe(false);
    const spanning = new Set(["2026-07-31", "2026-08-01"]);
    expect(isFullyBooked(spanning, "2026-08-01")).toBe(true);
  });
});

describe("isStayBlocked", () => {
  it("allows the 13 → 15 August stay ending on the changeover day another booking starts on", () => {
    expect(isStayBlocked(bookingStarting15th, "2026-08-13", "2026-08-15")).toBe(
      false,
    );
  });

  it("blocks any stay spanning a busy night", () => {
    expect(isStayBlocked(bookingStarting15th, "2026-08-13", "2026-08-16")).toBe(
      true,
    );
    expect(isStayBlocked(bookingEnding13th, "2026-08-08", "2026-08-20")).toBe(
      true,
    );
  });

  it("is direction-agnostic: completing a range backwards checks the same nights", () => {
    expect(isStayBlocked(bookingStarting15th, "2026-08-15", "2026-08-13")).toBe(
      false,
    );
    expect(isStayBlocked(bookingStarting15th, "2026-08-16", "2026-08-13")).toBe(
      true,
    );
  });

  it("allows a stay that fits exactly between two bookings (back-to-back turnaround)", () => {
    const both = new Set([...bookingEnding13th, ...bookingStarting15th]);
    expect(isStayBlocked(both, "2026-08-13", "2026-08-15")).toBe(false);
  });

  it("blocks nothing when no nights are booked", () => {
    expect(isStayBlocked(new Set(), "2026-08-13", "2026-09-01")).toBe(false);
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
  it("with nothing selected, only days inside bookings are disabled — changeover and checkout days stay open", () => {
    expect(
      isCalendarDayDisabled(bookingStarting15th, "2026-08-15", "", ""),
    ).toBe(false);
    expect(
      isCalendarDayDisabled(bookingStarting15th, "2026-08-16", "", ""),
    ).toBe(true);
    expect(isCalendarDayDisabled(bookingEnding13th, "2026-08-13", "", "")).toBe(
      false,
    );
    expect(
      isCalendarDayDisabled(bookingStarting15th, "2026-08-13", "", ""),
    ).toBe(false);
  });

  it("while an arrival is pending, days whose stay would span busy nights are disabled", () => {
    expect(
      isCalendarDayDisabled(
        bookingStarting15th,
        "2026-08-15",
        "2026-08-13",
        "",
      ),
    ).toBe(false);
    expect(
      isCalendarDayDisabled(
        bookingStarting15th,
        "2026-08-16",
        "2026-08-13",
        "",
      ),
    ).toBe(true);
    expect(
      isCalendarDayDisabled(
        bookingStarting15th,
        "2026-08-18",
        "2026-08-13",
        "",
      ),
    ).toBe(true);
  });

  it("allows completing a range backwards from a changeover day: click 15 first, then 13", () => {
    // The 15th is open in idle mode; picking it leaves no valid later
    // departure (its own night is busy) but earlier free days complete the
    // range as 13 → 15 via react-day-picker's backwards extension.
    expect(
      isCalendarDayDisabled(
        bookingStarting15th,
        "2026-08-13",
        "2026-08-15",
        "2026-08-15",
      ),
    ).toBe(false);
    expect(
      isCalendarDayDisabled(
        bookingStarting15th,
        "2026-08-16",
        "2026-08-15",
        "2026-08-15",
      ),
    ).toBe(true);
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

  it("keeps a day inside a booking disabled in both modes", () => {
    expect(isCalendarDayDisabled(bookingEnding13th, "2026-08-11", "", "")).toBe(
      true,
    );
    expect(
      isCalendarDayDisabled(bookingEnding13th, "2026-08-11", "2026-08-08", ""),
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

  it("renders a completed range without disabling its endpoints (idle rule keeps them open)", () => {
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
});
