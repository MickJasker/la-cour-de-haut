import { describe, it, expect } from "vitest";
import { addDays, subDays, formatISO } from "date-fns";
import {
  transition,
  canTransition,
  toDisplayStatus,
  isExpiredHold,
  type DbBookingStatus,
} from "./machine";

describe("transition — valid paths", () => {
  it("requested → on_hold on confirm, with blockInFeed + sendBankTransferEmail", () => {
    const result = transition("requested", "confirm");
    expect(result.nextStatus).toBe("on_hold");
    expect(result.sideEffects.blockInFeed).toBe(true);
    expect(result.sideEffects.sendBankTransferEmail).toBe(true);
  });

  it("requested → declined on decline", () => {
    const result = transition("requested", "decline");
    expect(result.nextStatus).toBe("declined");
    expect(result.sideEffects).toEqual({});
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

  it("deposit_paid → cancelled on cancel, with releaseFromFeed", () => {
    const result = transition("deposit_paid", "cancel");
    expect(result.nextStatus).toBe("cancelled");
    expect(result.sideEffects.releaseFromFeed).toBe(true);
  });

  it("on_hold → cancelled on cancel, with releaseFromFeed", () => {
    const result = transition("on_hold", "cancel");
    expect(result.nextStatus).toBe("cancelled");
    expect(result.sideEffects.releaseFromFeed).toBe(true);
  });

  it("confirmed → cancelled on cancel, with releaseFromFeed", () => {
    const result = transition("confirmed", "cancel");
    expect(result.nextStatus).toBe("cancelled");
    expect(result.sideEffects.releaseFromFeed).toBe(true);
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

  it("on_hold with past deadline → expired", () => {
    expect(
      toDisplayStatus({ status: "on_hold", paymentDeadline: pastDeadline }),
    ).toBe("expired");
  });

  it("on_hold with future deadline → on_hold", () => {
    expect(
      toDisplayStatus({ status: "on_hold", paymentDeadline: futureDeadline }),
    ).toBe("on_hold");
  });

  it("on_hold with null deadline → on_hold (no deadline set yet)", () => {
    expect(toDisplayStatus({ status: "on_hold", paymentDeadline: null })).toBe(
      "on_hold",
    );
  });

  it("confirmed with past deadline → confirmed (expiry only applies to on_hold)", () => {
    expect(
      toDisplayStatus({ status: "confirmed", paymentDeadline: pastDeadline }),
    ).toBe("confirmed");
  });

  it("deposit_paid passes through unchanged (expiry only applies to on_hold)", () => {
    expect(
      toDisplayStatus({
        status: "deposit_paid",
        paymentDeadline: pastDeadline,
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
        toDisplayStatus({ status: s, paymentDeadline: pastDeadline }),
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
      toDisplayStatus({ status: "on_hold", paymentDeadline: YESTERDAY }, TODAY),
    ).toBe("expired");
    expect(
      toDisplayStatus({ status: "on_hold", paymentDeadline: TODAY }, TODAY),
    ).toBe("on_hold");
  });
});
