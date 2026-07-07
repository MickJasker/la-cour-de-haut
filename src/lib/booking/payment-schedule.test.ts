import { describe, it, expect } from "vitest";
import { computePaymentSchedule } from "./payment-schedule";

// Default settings per issue #162: 50% deposit due 3 days after confirm,
// balance (incl. borg) due 7 days before arrival.
const SETTINGS = {
  depositPercentage: 50,
  depositDeadlineDays: 3,
  balanceDueDaysBeforeArrival: 7,
};

describe("computePaymentSchedule", () => {
  it("collapses to a single payment when the balance deadline equals the deposit deadline", () => {
    // confirm + 3 = 2026-07-10; arrival − 7 = 2026-07-10 → on the boundary,
    // "on or before" means collapse.
    const schedule = computePaymentSchedule(
      1000,
      200,
      "2026-07-07",
      "2026-07-17",
      SETTINGS,
    );

    expect(schedule).toEqual({
      collapsed: true,
      totalAmount: 1200, // 100% + borg
      deadline: "2026-07-10", // within depositDeadlineDays, before arrival − 1
    });
  });

  it("does not collapse when the balance deadline is one day after the deposit deadline", () => {
    // confirm + 3 = 2026-07-10; arrival − 7 = 2026-07-11 → still two steps.
    const schedule = computePaymentSchedule(
      1000,
      200,
      "2026-07-07",
      "2026-07-18",
      SETTINGS,
    );

    expect(schedule).toMatchObject({
      collapsed: false,
      depositDeadline: "2026-07-10",
      balanceDeadline: "2026-07-11",
    });
  });

  it("clamps the collapsed deadline to the day before arrival when arrival is sooner than the deposit window", () => {
    // confirm + 3 = 2026-07-10, but arrival is already 2026-07-09 → the
    // single payment is due the day before arrival, 2026-07-08.
    const schedule = computePaymentSchedule(
      1000,
      200,
      "2026-07-07",
      "2026-07-09",
      SETTINGS,
    );

    expect(schedule).toEqual({
      collapsed: true,
      totalAmount: 1200,
      deadline: "2026-07-08",
    });
  });

  it("rounds the deposit to whole cents and gives the balance the remainder", () => {
    const schedule = computePaymentSchedule(
      333.33,
      200,
      "2026-07-07",
      "2026-08-01",
      SETTINGS,
    );

    // 50% of 333.33 is 166.665 → rounds to 166.67; the balance takes the
    // remaining 166.66 so both payments sum to exactly total + borg.
    expect(schedule).toMatchObject({
      collapsed: false,
      depositAmount: 166.67,
      balanceAmount: 366.66,
    });
  });

  it("computes cent amounts without floating-point drift", () => {
    const schedule = computePaymentSchedule(
      1234.56,
      150.5,
      "2026-07-07",
      "2026-08-01",
      { ...SETTINGS, depositPercentage: 33 },
    );

    // 33% of 123456 cents = 40740.48 → 407.40; balance = 827.16 + 150.50.
    expect(schedule).toMatchObject({
      collapsed: false,
      depositAmount: 407.4,
      balanceAmount: 977.66,
    });
  });

  it("handles a zero borg: the balance is just the remainder of the total", () => {
    const twoStep = computePaymentSchedule(
      1000,
      0,
      "2026-07-07",
      "2026-08-01",
      SETTINGS,
    );
    expect(twoStep).toMatchObject({
      collapsed: false,
      depositAmount: 500,
      balanceAmount: 500,
    });

    const collapsed = computePaymentSchedule(
      1000,
      0,
      "2026-07-07",
      "2026-07-09",
      SETTINGS,
    );
    expect(collapsed).toMatchObject({
      collapsed: true,
      totalAmount: 1000,
    });
  });

  it("does day arithmetic across month boundaries", () => {
    const schedule = computePaymentSchedule(
      1000,
      200,
      "2026-07-30",
      "2026-09-02",
      SETTINGS,
    );
    expect(schedule).toMatchObject({
      collapsed: false,
      depositDeadline: "2026-08-02",
      balanceDeadline: "2026-08-26",
    });
  });

  it("splits a normal booking into a deposit and a balance incl. borg", () => {
    const schedule = computePaymentSchedule(
      1000,
      200,
      "2026-07-07",
      "2026-08-01",
      SETTINGS,
    );

    expect(schedule).toEqual({
      collapsed: false,
      depositAmount: 500,
      depositDeadline: "2026-07-10", // confirm + 3 days
      balanceAmount: 700, // 500 remainder + 200 borg
      balanceDeadline: "2026-07-25", // arrival − 7 days
    });
  });
});
