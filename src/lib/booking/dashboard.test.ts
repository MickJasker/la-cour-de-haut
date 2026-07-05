import { describe, it, expect } from "vitest";
import {
  computeDashboard,
  type BookingRow,
  type IcalSourceRow,
} from "./dashboard";

// Helpers to narrow union types in assertions
function asBooking(entry: ReturnType<typeof computeDashboard>["upcoming"][0]) {
  if (entry.type !== "booking") throw new Error("Expected booking entry");
  return entry;
}
function asIcal(entry: ReturnType<typeof computeDashboard>["upcoming"][0]) {
  if (entry.type !== "ical") throw new Error("Expected ical entry");
  return entry;
}

const TODAY = "2026-06-26";

function booking(overrides: Partial<BookingRow> = {}): BookingRow {
  return {
    id: "b1",
    name: "Test Guest",
    startDate: "2026-08-01",
    endDate: "2026-08-08",
    guestCount: 2,
    status: "requested",
    paymentDeadline: null,
    ...overrides,
  };
}

function feed(overrides: Partial<IcalSourceRow> = {}): IcalSourceRow {
  return {
    id: "f1",
    name: "Airbnb",
    lastError: null,
    lastErrorAt: null,
    cachedIntervals: null,
    ...overrides,
  };
}

describe("computeDashboard — new requests", () => {
  it("puts a requested booking in newRequests", () => {
    const result = computeDashboard(
      [booking({ status: "requested" })],
      [],
      TODAY,
    );
    expect(result.newRequests).toHaveLength(1);
    expect(result.newRequests[0].name).toBe("Test Guest");
  });
});

describe("computeDashboard — upcoming confirmed stays", () => {
  it("puts a confirmed booking with future startDate in upcoming as type=booking", () => {
    const result = computeDashboard(
      [booking({ status: "confirmed", startDate: "2026-07-10" })],
      [],
      TODAY,
    );
    expect(result.upcoming).toHaveLength(1);
    expect(asBooking(result.upcoming[0]).name).toBe("Test Guest");
  });

  it("does not include a confirmed booking that already ended", () => {
    const result = computeDashboard(
      [
        booking({
          status: "confirmed",
          startDate: "2026-06-01",
          endDate: "2026-06-08",
        }),
      ],
      [],
      TODAY,
    );
    expect(result.upcoming).toHaveLength(0);
  });

  it("includes a confirmed booking that is currently in progress", () => {
    const result = computeDashboard(
      [
        booking({
          status: "confirmed",
          startDate: "2026-06-24",
          endDate: "2026-07-01",
        }),
      ],
      [],
      TODAY,
    );
    expect(result.upcoming).toHaveLength(1);
    expect(asBooking(result.upcoming[0]).name).toBe("Test Guest");
  });

  it("sorts upcoming stays by startDate ascending across both types", () => {
    const result = computeDashboard(
      [
        booking({ id: "b2", status: "confirmed", startDate: "2026-09-01" }),
        booking({ id: "b1", status: "confirmed", startDate: "2026-07-10" }),
      ],
      [],
      TODAY,
    );
    expect(result.upcoming[0].startDate).toBe("2026-07-10");
    expect(result.upcoming[1].startDate).toBe("2026-09-01");
  });

  it("does not include non-confirmed bookings in upcoming", () => {
    const result = computeDashboard(
      [booking({ status: "requested", startDate: "2026-07-10" })],
      [],
      TODAY,
    );
    expect(result.upcoming).toHaveLength(0);
  });
});

describe("computeDashboard — upcoming iCal intervals", () => {
  it("includes a future iCal interval as type=ical", () => {
    const result = computeDashboard(
      [],
      [
        feed({
          name: "Airbnb",
          cachedIntervals: [{ start: "2026-08-01", end: "2026-08-08" }],
        }),
      ],
      TODAY,
    );
    expect(result.upcoming).toHaveLength(1);
    expect(asIcal(result.upcoming[0]).sourceName).toBe("Airbnb");
    expect(result.upcoming[0].startDate).toBe("2026-08-01");
  });

  it("excludes a past iCal interval (end date before today)", () => {
    const result = computeDashboard(
      [],
      [
        feed({
          cachedIntervals: [{ start: "2026-06-01", end: "2026-06-08" }],
        }),
      ],
      TODAY,
    );
    expect(result.upcoming).toHaveLength(0);
  });

  it("includes an interval ending today (end >= today)", () => {
    const result = computeDashboard(
      [],
      [feed({ cachedIntervals: [{ start: "2026-06-20", end: TODAY }] })],
      TODAY,
    );
    expect(result.upcoming).toHaveLength(1);
  });

  it("sorts iCal intervals together with booking entries by startDate", () => {
    const result = computeDashboard(
      [booking({ status: "confirmed", startDate: "2026-09-01" })],
      [
        feed({
          name: "Airbnb",
          cachedIntervals: [{ start: "2026-07-15", end: "2026-07-22" }],
        }),
      ],
      TODAY,
    );
    expect(result.upcoming[0].startDate).toBe("2026-07-15");
    expect(asIcal(result.upcoming[0]).sourceName).toBe("Airbnb");
    expect(result.upcoming[1].startDate).toBe("2026-09-01");
  });

  it("handles a source with no cached intervals", () => {
    const result = computeDashboard(
      [],
      [feed({ cachedIntervals: null })],
      TODAY,
    );
    expect(result.upcoming).toHaveLength(0);
  });
});

describe("computeDashboard — broken iCal feeds", () => {
  it("puts a feed with lastError in brokenFeeds", () => {
    const result = computeDashboard(
      [],
      [feed({ lastError: "HTTP 403 Forbidden", lastErrorAt: new Date() })],
      TODAY,
    );
    expect(result.brokenFeeds).toHaveLength(1);
    expect(result.brokenFeeds[0].name).toBe("Airbnb");
  });

  it("does not include a healthy feed in brokenFeeds", () => {
    const result = computeDashboard([], [feed({ lastError: null })], TODAY);
    expect(result.brokenFeeds).toHaveLength(0);
  });
});

describe("computeDashboard — approaching deadline", () => {
  it("puts on_hold with deadline in 2 days in approaching", () => {
    const result = computeDashboard(
      [booking({ status: "on_hold", paymentDeadline: "2026-06-28" })],
      [],
      TODAY,
    );
    expect(result.approaching).toHaveLength(1);
    expect(result.overdue).toHaveLength(0);
  });

  it("puts on_hold with deadline exactly 3 days out in approaching", () => {
    const result = computeDashboard(
      [booking({ status: "on_hold", paymentDeadline: "2026-06-29" })],
      [],
      TODAY,
    );
    expect(result.approaching).toHaveLength(1);
  });

  it("does not surface on_hold with deadline 4 days out", () => {
    const result = computeDashboard(
      [booking({ status: "on_hold", paymentDeadline: "2026-06-30" })],
      [],
      TODAY,
    );
    expect(result.approaching).toHaveLength(0);
    expect(result.overdue).toHaveLength(0);
  });

  it("does not put overdue booking in approaching", () => {
    const result = computeDashboard(
      [booking({ status: "on_hold", paymentDeadline: "2026-06-25" })],
      [],
      TODAY,
    );
    expect(result.approaching).toHaveLength(0);
    expect(result.overdue).toHaveLength(1);
  });
});

describe("computeDashboard — overdue payments", () => {
  it("puts an on_hold booking with past deadline in overdue", () => {
    const result = computeDashboard(
      [booking({ status: "on_hold", paymentDeadline: "2026-06-25" })],
      [],
      TODAY,
    );
    expect(result.overdue).toHaveLength(1);
    expect(result.newRequests).toHaveLength(0);
  });

  it("does not put on_hold with today's deadline in overdue", () => {
    const result = computeDashboard(
      [booking({ status: "on_hold", paymentDeadline: TODAY })],
      [],
      TODAY,
    );
    expect(result.overdue).toHaveLength(0);
  });
});

describe("computeDashboard — admin dashboard never treats an expired hold as active/upcoming", () => {
  it("an expired on_hold booking with a future startDate is overdue, not upcoming or approaching", () => {
    // Mirrors what the admin dashboard's query fetches: every non-declined/
    // cancelled booking, including holds whose payment deadline has already
    // passed. The shared isExpiredHold predicate (consumed via `overdue`)
    // must keep it out of `upcoming` and `approaching`.
    const expiredHold = booking({
      id: "expired-1",
      status: "on_hold",
      paymentDeadline: "2026-06-20", // well before TODAY
      startDate: "2026-08-01", // still in the future — must not leak into upcoming
      endDate: "2026-08-08",
    });

    const result = computeDashboard([expiredHold], [], TODAY);

    expect(result.overdue).toHaveLength(1);
    expect(result.overdue[0].id).toBe("expired-1");
    expect(result.approaching).toHaveLength(0);
    expect(result.upcoming).toHaveLength(0);
  });

  it("categorises a mixed batch (requested, expired hold, live hold, confirmed) consistently", () => {
    const bookings = [
      booking({ id: "req", status: "requested" }),
      booking({
        id: "expired",
        status: "on_hold",
        paymentDeadline: "2026-06-01",
      }),
      booking({
        id: "live-hold",
        status: "on_hold",
        paymentDeadline: "2026-07-01",
      }),
      booking({
        id: "confirmed",
        status: "confirmed",
        startDate: "2026-07-15",
      }),
    ];

    const result = computeDashboard(bookings, [], TODAY);

    expect(result.newRequests.map((b) => b.id)).toEqual(["req"]);
    expect(result.overdue.map((b) => b.id)).toEqual(["expired"]);
    expect(result.approaching).toHaveLength(0);
    expect(result.upcoming).toHaveLength(1);
    expect(asBooking(result.upcoming[0]).name).toBe("Test Guest");
  });
});
