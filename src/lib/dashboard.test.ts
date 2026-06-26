import { describe, it, expect } from "vitest";
import {
  computeDashboard,
  type BookingRow,
  type IcalSourceRow,
} from "./dashboard";

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
  it("puts a confirmed booking with future startDate in upcoming", () => {
    const result = computeDashboard(
      [booking({ status: "confirmed", startDate: "2026-07-10" })],
      [],
      TODAY,
    );
    expect(result.upcoming).toHaveLength(1);
  });

  it("does not include a confirmed booking that started in the past", () => {
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

  it("sorts upcoming stays by startDate ascending", () => {
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
