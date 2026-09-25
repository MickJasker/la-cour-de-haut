import { describe, it, expect } from "vitest";
import { addDays, subDays, formatISO } from "date-fns";
import {
  transition,
  canTransition,
  toDisplayStatus,
  isExpiredHold,
  isPastCheckout,
  type DbBookingStatus,
} from "./machine";

describe("transition — valid paths", () => {
  it("requested → on_hold on confirm, with blockInFeed + sendBankTransferEmail", () => {
    const result = transition("requested", "confirm");
    expect(result.nextStatus).toBe("on_hold");
    expect(result.sideEffects.blockInFeed).toBe(true);
    expect(result.sideEffects.sendBankTransferEmail).toBe(true);
  });

  it("requested → declined on decline, with sendDeclineEmail", () => {
    const result = transition("requested", "decline");
    expect(result.nextStatus).toBe("declined");
    expect(result.sideEffects).toEqual({ sendDeclineEmail: true });
  });

  it("on_hold → deposit_paid on mark_deposit_paid (two-stage path), with sendDepositReceivedEmail", () => {
    const result = transition("on_hold", "mark_deposit_paid");
    expect(result.nextStatus).toBe("deposit_paid");
    expect(result.sideEffects).toEqual({ sendDepositReceivedEmail: true });
  });

  it("on_hold → confirmed on mark_paid (collapse path), with sendBalanceReceivedEmail", () => {
    const result = transition("on_hold", "mark_paid");
    expect(result.nextStatus).toBe("confirmed");
    expect(result.sideEffects).toEqual({ sendBalanceReceivedEmail: true });
  });

  it("deposit_paid → confirmed on mark_balance_paid, with sendBalanceReceivedEmail", () => {
    const result = transition("deposit_paid", "mark_balance_paid");
    expect(result.nextStatus).toBe("confirmed");
    expect(result.sideEffects).toEqual({ sendBalanceReceivedEmail: true });
  });

  it("deposit_paid → cancelled on cancel, with releaseFromFeed + sendCancellationEmail", () => {
    const result = transition("deposit_paid", "cancel");
    expect(result.nextStatus).toBe("cancelled");
    expect(result.sideEffects.releaseFromFeed).toBe(true);
    expect(result.sideEffects.sendCancellationEmail).toBe(true);
  });

  it("on_hold → cancelled on cancel, with releaseFromFeed + sendCancellationEmail", () => {
    const result = transition("on_hold", "cancel");
    expect(result.nextStatus).toBe("cancelled");
    expect(result.sideEffects.releaseFromFeed).toBe(true);
    expect(result.sideEffects.sendCancellationEmail).toBe(true);
  });

  it("confirmed → cancelled on cancel, with releaseFromFeed + sendCancellationEmail", () => {
    const result = transition("confirmed", "cancel");
    expect(result.nextStatus).toBe("cancelled");
    expect(result.sideEffects.releaseFromFeed).toBe(true);
    expect(result.sideEffects.sendCancellationEmail).toBe(true);
  });
});

describe("transition — invalid paths", () => {
  const invalidCases: [DbBookingStatus, Parameters<typeof transition>[1]][] = [
    ["on_hold", "confirm"],
    ["on_hold", "decline"],
    ["on_hold", "mark_balance_paid"],
    ["deposit_paid", "confirm"],
    ["deposit_paid", "decline"],
    ["deposit_paid", "mark_deposit_paid"],
    ["deposit_paid", "mark_paid"],
    ["confirmed", "confirm"],
    ["confirmed", "mark_paid"],
    ["confirmed", "mark_deposit_paid"],
    ["confirmed", "mark_balance_paid"],
    ["confirmed", "decline"],
    ["declined", "confirm"],
    ["declined", "cancel"],
    ["cancelled", "confirm"],
    ["cancelled", "cancel"],
  ];

  for (const [status, action] of invalidCases) {
    it(`throws for '${action}' from '${status}'`, () => {
      expect(() => transition(status, action)).toThrow();
    });
  }
});

describe("canTransition", () => {
  it("returns true for valid transitions", () => {
    expect(canTransition("requested", "confirm")).toBe(true);
    expect(canTransition("on_hold", "mark_paid")).toBe(true);
  });

  it("returns false for invalid transitions", () => {
    expect(canTransition("confirmed", "confirm")).toBe(false);
    expect(canTransition("declined", "cancel")).toBe(false);
  });
});

describe("toDisplayStatus — lazy expiry", () => {
  const pastDeadline = formatISO(subDays(new Date(), 1), {
    representation: "date",
  });
  const futureDeadline = formatISO(addDays(new Date(), 1), {
    representation: "date",
  });
  // Every row in this block is about hold expiry, so its stay is kept well in
  // the future — otherwise a `confirmed` row would also trip the `past` rule.
  const futureEnd = formatISO(addDays(new Date(), 30), {
    representation: "date",
  });

  it("on_hold with past deadline → expired", () => {
    expect(
      toDisplayStatus({
        status: "on_hold",
        paymentDeadline: pastDeadline,
        endDate: futureEnd,
      }),
    ).toBe("expired");
  });

  it("on_hold with future deadline → on_hold", () => {
    expect(
      toDisplayStatus({
        status: "on_hold",
        paymentDeadline: futureDeadline,
        endDate: futureEnd,
      }),
    ).toBe("on_hold");
  });

  it("on_hold with null deadline → on_hold (no deadline set yet)", () => {
    expect(
      toDisplayStatus({
        status: "on_hold",
        paymentDeadline: null,
        endDate: futureEnd,
      }),
    ).toBe("on_hold");
  });

  it("confirmed with past deadline → confirmed (expiry only applies to on_hold)", () => {
    expect(
      toDisplayStatus({
        status: "confirmed",
        paymentDeadline: pastDeadline,
        endDate: futureEnd,
      }),
    ).toBe("confirmed");
  });

  it("deposit_paid passes through unchanged (expiry only applies to on_hold)", () => {
    expect(
      toDisplayStatus({
        status: "deposit_paid",
        paymentDeadline: pastDeadline,
        endDate: futureEnd,
      }),
    ).toBe("deposit_paid");
  });

  it("passes through all other statuses unchanged", () => {
    const statuses: DbBookingStatus[] = [
      "requested",
      "deposit_paid",
      "confirmed",
      "declined",
      "cancelled",
    ];
    for (const s of statuses) {
      expect(
        toDisplayStatus({
          status: s,
          paymentDeadline: pastDeadline,
          endDate: futureEnd,
        }),
      ).toBe(s);
    }
  });
});

describe("isExpiredHold — the single hold-expiry predicate (ADR-0004)", () => {
  const TODAY = "2026-06-30";
  const YESTERDAY = "2026-06-29";

  it("on_hold with deadline yesterday is expired", () => {
    expect(
      isExpiredHold({ status: "on_hold", paymentDeadline: YESTERDAY }, TODAY),
    ).toBe(true);
  });

  it("on_hold with deadline exactly today is NOT expired (boundary)", () => {
    expect(
      isExpiredHold({ status: "on_hold", paymentDeadline: TODAY }, TODAY),
    ).toBe(false);
  });

  it("on_hold with a future deadline is not expired", () => {
    expect(
      isExpiredHold(
        { status: "on_hold", paymentDeadline: "2026-07-01" },
        TODAY,
      ),
    ).toBe(false);
  });

  it("on_hold with no deadline yet is not expired", () => {
    expect(
      isExpiredHold({ status: "on_hold", paymentDeadline: null }, TODAY),
    ).toBe(false);
  });

  it("non on_hold statuses are never expired, even with a past deadline", () => {
    const statuses = [
      "requested",
      "deposit_paid",
      "confirmed",
      "declined",
      "cancelled",
    ];
    for (const status of statuses) {
      expect(isExpiredHold({ status, paymentDeadline: YESTERDAY }, TODAY)).toBe(
        false,
      );
    }
  });

  it("defaults `today` to the real current date when omitted", () => {
    const pastDeadline = formatISO(subDays(new Date(), 1), {
      representation: "date",
    });
    expect(
      isExpiredHold({ status: "on_hold", paymentDeadline: pastDeadline }),
    ).toBe(true);
  });

  it("toDisplayStatus accepts an explicit `today` and agrees with isExpiredHold", () => {
    expect(
      toDisplayStatus(
        {
          status: "on_hold",
          paymentDeadline: YESTERDAY,
          endDate: "2026-07-05",
        },
        TODAY,
      ),
    ).toBe("expired");
    expect(
      toDisplayStatus(
        { status: "on_hold", paymentDeadline: TODAY, endDate: "2026-07-05" },
        TODAY,
      ),
    ).toBe("on_hold");
  });
});

describe("isPastCheckout — midday Europe/Paris on the checkout day", () => {
  // Summer: Paris runs on CEST (UTC+2), so 12:00 local is 10:00 UTC.
  describe("during CEST (UTC+2)", () => {
    const END_DATE = "2026-07-15";

    it("is false one minute before midday Paris (09:59 UTC = 11:59 Paris)", () => {
      expect(isPastCheckout(END_DATE, new Date("2026-07-15T09:59:00Z"))).toBe(
        false,
      );
    });

    it("is true exactly at midday Paris (10:00 UTC = 12:00 Paris)", () => {
      expect(isPastCheckout(END_DATE, new Date("2026-07-15T10:00:00Z"))).toBe(
        true,
      );
    });

    it("is true one minute after midday Paris (10:01 UTC = 12:01 Paris)", () => {
      expect(isPastCheckout(END_DATE, new Date("2026-07-15T10:01:00Z"))).toBe(
        true,
      );
    });
  });

  // Winter: Paris runs on CET (UTC+1), so 12:00 local is 11:00 UTC — an hour
  // later in absolute terms than the summer case above. A hard-coded offset
  // would get exactly one of these two blocks wrong.
  describe("during CET (UTC+1)", () => {
    const END_DATE = "2026-01-15";

    it("is false one minute before midday Paris (10:59 UTC = 11:59 Paris)", () => {
      expect(isPastCheckout(END_DATE, new Date("2026-01-15T10:59:00Z"))).toBe(
        false,
      );
    });

    it("is true exactly at midday Paris (11:00 UTC = 12:00 Paris)", () => {
      expect(isPastCheckout(END_DATE, new Date("2026-01-15T11:00:00Z"))).toBe(
        true,
      );
    });
  });

  // The EU switches at 01:00 UTC on the last Sunday of March/October, i.e.
  // long before midday, so the transition day itself already runs on the new
  // offset by checkout time. 10:00 UTC is therefore *past* checkout on
  // 2026-03-29 (already CEST) but *before* it on 2026-10-25 (back on CET).
  describe("across the DST transitions", () => {
    it("treats 10:00 UTC as midday on the spring-forward day (2026-03-29, CEST)", () => {
      expect(
        isPastCheckout("2026-03-29", new Date("2026-03-29T09:59:00Z")),
      ).toBe(false);
      expect(
        isPastCheckout("2026-03-29", new Date("2026-03-29T10:00:00Z")),
      ).toBe(true);
    });

    it("still needs 11:00 UTC on the fall-back day (2026-10-25, CET)", () => {
      expect(
        isPastCheckout("2026-10-25", new Date("2026-10-25T10:00:00Z")),
      ).toBe(false);
      expect(
        isPastCheckout("2026-10-25", new Date("2026-10-25T11:00:00Z")),
      ).toBe(true);
    });
  });

  it("is false on the morning of the checkout day and true that afternoon", () => {
    expect(isPastCheckout("2026-07-15", new Date("2026-07-15T06:00:00Z"))).toBe(
      false,
    );
    expect(isPastCheckout("2026-07-15", new Date("2026-07-15T16:00:00Z"))).toBe(
      true,
    );
  });

  it("is false for any instant before the checkout day", () => {
    // 22:00 UTC on the 14th is already the 15th in Paris (00:00 CEST) — but
    // still midnight, not midday, so checkout has not happened.
    expect(isPastCheckout("2026-07-15", new Date("2026-07-14T22:00:00Z"))).toBe(
      false,
    );
    expect(isPastCheckout("2026-07-15", new Date("2026-07-10T12:00:00Z"))).toBe(
      false,
    );
  });

  it("is true for any instant well after the checkout day", () => {
    expect(isPastCheckout("2026-07-15", new Date("2026-08-01T00:00:00Z"))).toBe(
      true,
    );
  });

  it("defaults `now` to the real current instant when omitted", () => {
    const longPast = formatISO(subDays(new Date(), 30), {
      representation: "date",
    });
    const farFuture = formatISO(addDays(new Date(), 30), {
      representation: "date",
    });
    expect(isPastCheckout(longPast)).toBe(true);
    expect(isPastCheckout(farFuture)).toBe(false);
  });
});

describe("toDisplayStatus — lazy 'past' for ended stays", () => {
  const END_DATE = "2026-07-15";
  const BEFORE_CHECKOUT = new Date("2026-07-15T09:59:00Z"); // 11:59 Paris
  const AT_CHECKOUT = new Date("2026-07-15T10:00:00Z"); // 12:00 Paris
  const LONG_AFTER = new Date("2027-01-01T00:00:00Z");
  // Keeps hold expiry out of the picture: these rows are about `past` only.
  const NO_DEADLINE = null;

  it("confirmed before midday Paris on endDate → confirmed", () => {
    expect(
      toDisplayStatus(
        {
          status: "confirmed",
          paymentDeadline: NO_DEADLINE,
          endDate: END_DATE,
        },
        undefined,
        BEFORE_CHECKOUT,
      ),
    ).toBe("confirmed");
  });

  it("confirmed at midday Paris on endDate → past", () => {
    expect(
      toDisplayStatus(
        {
          status: "confirmed",
          paymentDeadline: NO_DEADLINE,
          endDate: END_DATE,
        },
        undefined,
        AT_CHECKOUT,
      ),
    ).toBe("past");
  });

  it("confirmed long after checkout → past", () => {
    expect(
      toDisplayStatus(
        {
          status: "confirmed",
          paymentDeadline: NO_DEADLINE,
          endDate: END_DATE,
        },
        undefined,
        LONG_AFTER,
      ),
    ).toBe("past");
  });

  it("deposit_paid stays deposit_paid long after checkout (an unpaid balance must not be hidden)", () => {
    expect(
      toDisplayStatus(
        {
          status: "deposit_paid",
          paymentDeadline: NO_DEADLINE,
          endDate: END_DATE,
        },
        undefined,
        LONG_AFTER,
      ),
    ).toBe("deposit_paid");
  });

  it("no other status ages into past either", () => {
    const statuses: DbBookingStatus[] = [
      "requested",
      "on_hold",
      "deposit_paid",
      "declined",
      "cancelled",
    ];
    for (const status of statuses) {
      expect(
        toDisplayStatus(
          { status, paymentDeadline: NO_DEADLINE, endDate: END_DATE },
          undefined,
          LONG_AFTER,
        ),
      ).toBe(status);
    }
  });

  it("expiry wins over past: an expired hold whose dates have also gone by stays expired", () => {
    expect(
      toDisplayStatus(
        {
          status: "on_hold",
          paymentDeadline: "2026-07-01",
          endDate: END_DATE,
        },
        "2026-07-20",
        LONG_AFTER,
      ),
    ).toBe("expired");
  });
});
