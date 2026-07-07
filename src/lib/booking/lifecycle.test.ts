import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import {
  calculatePriceBreakdown,
  calculateTotalNights,
} from "@/app/[locale]/book/shared";
import { toUtcDayString } from "./calendar-day";
import { computePaymentSchedule, scheduleToSnapshot } from "./payment-schedule";

vi.mock("@/db", () => ({ getDb: vi.fn() }));
vi.mock("@/db/schema", () => ({ bookingRequest: {} }));
vi.mock("drizzle-orm", () => ({ eq: vi.fn() }));
vi.mock("@/lib/settings/settings", () => ({
  getSettings: vi.fn(),
  hasBankDetails: vi.fn(),
  paymentScheduleSettings: vi.fn(),
  securityDepositAmount: vi.fn(),
}));
vi.mock("./bank-transfer-email", () => ({
  sendBankTransferEmail: vi.fn(),
}));
vi.mock("./deposit-received-email", () => ({
  sendDepositReceivedEmail: vi.fn(),
}));
vi.mock("./balance-received-email", () => ({
  sendBalanceReceivedEmail: vi.fn(),
}));
vi.mock("./availability", () => ({ isRangeAvailable: vi.fn() }));

import { getDb } from "@/db";
import {
  getSettings,
  hasBankDetails,
  paymentScheduleSettings,
  securityDepositAmount,
} from "@/lib/settings/settings";
import { sendBankTransferEmail } from "./bank-transfer-email";
import { sendDepositReceivedEmail } from "./deposit-received-email";
import { sendBalanceReceivedEmail } from "./balance-received-email";
import { isRangeAvailable } from "./availability";
import { applyTransition } from "./lifecycle";

// Booking runs 2027-09-01 → 2027-09-07 (6 nights), far enough out that the
// schedule never collapses.
const baseBooking = {
  id: "bk-1",
  name: "Anna Schmidt",
  email: "anna@example.com",
  guestCount: 2,
  locale: "de",
  startDate: "2027-09-01",
  endDate: "2027-09-07",
  status: "requested",
  // Frozen at submit time — deliberately different from
  // mockSettings.price_per_night so tests can prove the email renders this
  // value, not a live re-computation from settings.
  shownPriceAtBooking: "100",
};

const SCHEDULE_SETTINGS = {
  depositPercentage: 50,
  depositDeadlineDays: 3,
  balanceDueDaysBeforeArrival: 7,
};
const BORG = 200;

const mockSettings = {
  iban: "NL91ABNA0417164300",
  bank_name: "Test Bank",
  account_holder: "La Cour de Haut",
  price_per_night: 999,
};

function makeMockDb(rows: unknown[] = [baseBooking]) {
  const where = vi.fn().mockResolvedValue(rows);
  const set = vi.fn().mockReturnValue({ where });
  const from = vi.fn().mockReturnValue({ where });
  return {
    select: vi.fn().mockReturnValue({ from }),
    update: vi.fn().mockReturnValue({ set }),
    _where: where,
    _set: set,
  };
}

/** The schedule + snapshot the lifecycle should freeze for baseBooking. */
function expectedForBase(shownPrice = baseBooking.shownPriceAtBooking) {
  const nights = calculateTotalNights(
    baseBooking.startDate,
    baseBooking.endDate,
  );
  const { totalPrice } = calculatePriceBreakdown(
    Number(shownPrice),
    nights,
    baseBooking.guestCount,
  );
  const schedule = computePaymentSchedule(
    totalPrice,
    BORG,
    toUtcDayString(),
    baseBooking.startDate,
    SCHEDULE_SETTINGS,
  );
  return { schedule, snapshot: scheduleToSnapshot(schedule, BORG) };
}

beforeEach(() => {
  vi.clearAllMocks();
  (getSettings as Mock).mockResolvedValue(mockSettings);
  // hasBankDetails is a type predicate at the type level, so it can't be
  // widened to `Mock` via `as` — vi.mocked() preserves its real signature.
  vi.mocked(hasBankDetails).mockReturnValue(true);
  (paymentScheduleSettings as Mock).mockReturnValue(SCHEDULE_SETTINGS);
  (securityDepositAmount as Mock).mockReturnValue(BORG);
  (isRangeAvailable as Mock).mockResolvedValue(true);
  (sendBankTransferEmail as Mock).mockResolvedValue(undefined);
  (sendDepositReceivedEmail as Mock).mockResolvedValue(undefined);
  (sendBalanceReceivedEmail as Mock).mockResolvedValue(undefined);
});

// A booking whose two-stage schedule was frozen at confirm time (ADR-0021):
// on_hold awaiting the deposit, or deposit_paid awaiting the balance.
const twoStageSnapshot = {
  paymentCollapsed: false,
  depositAmount: "300",
  balanceAmount: "500",
  paymentDeadline: "2027-08-10",
  balanceDeadline: "2027-08-25",
  securityDepositAtBooking: "200",
};

// A booking whose short-notice schedule collapsed to a single payment.
const collapsedSnapshot = {
  paymentCollapsed: true,
  depositAmount: "833",
  balanceAmount: null,
  paymentDeadline: "2027-08-10",
  balanceDeadline: null,
  securityDepositAtBooking: "200",
};

describe("applyTransition — confirm", () => {
  it("updates DB status to on_hold and sends bank transfer email", async () => {
    const db = makeMockDb();
    (getDb as Mock).mockReturnValue(db);

    await applyTransition("bk-1", "confirm");

    expect(db._set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "on_hold" }),
    );
    expect(sendBankTransferEmail).toHaveBeenCalledOnce();
    expect(sendBankTransferEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        guest: { name: baseBooking.name, email: baseBooking.email },
      }),
    );
  });

  it("freezes the computed payment-schedule snapshot onto the booking", async () => {
    const db = makeMockDb();
    (getDb as Mock).mockReturnValue(db);

    await applyTransition("bk-1", "confirm");

    const { snapshot } = expectedForBase();
    expect(db._set).toHaveBeenCalledWith(expect.objectContaining(snapshot));
    // confirmedAt is stamped as a real Date.
    const setArg = db._set.mock.calls[0]![0] as { confirmedAt: unknown };
    expect(setArg.confirmedAt).toBeInstanceOf(Date);
  });

  it("passes the frozen schedule and borg to the bank-transfer email", async () => {
    const db = makeMockDb();
    (getDb as Mock).mockReturnValue(db);

    await applyTransition("bk-1", "confirm");

    const { schedule } = expectedForBase();
    expect(sendBankTransferEmail).toHaveBeenCalledWith(
      expect.objectContaining({ schedule, securityDeposit: BORG }),
    );
  });

  it("surfaces bank transfer email errors — not fire-and-forget", async () => {
    const db = makeMockDb();
    (getDb as Mock).mockReturnValue(db);
    (sendBankTransferEmail as Mock).mockRejectedValue(new Error("SMTP down"));

    await expect(applyTransition("bk-1", "confirm")).rejects.toThrow(
      "SMTP down",
    );
  });

  it("rolls back DB status and clears the snapshot when email send fails", async () => {
    const db = makeMockDb();
    (getDb as Mock).mockReturnValue(db);
    (sendBankTransferEmail as Mock).mockRejectedValue(new Error("SMTP down"));

    await expect(applyTransition("bk-1", "confirm")).rejects.toThrow(
      "SMTP down",
    );

    // Second _set call restores original status and nulls the snapshot.
    expect(db._set).toHaveBeenCalledTimes(2);
    expect(db._set).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: "requested",
        confirmedAt: null,
        paymentCollapsed: null,
        depositAmount: null,
        balanceAmount: null,
        balanceDeadline: null,
        securityDepositAtBooking: null,
      }),
    );
  });

  it("rolls back when the email transport is unconfigured (same policy as any send failure)", async () => {
    const db = makeMockDb();
    (getDb as Mock).mockReturnValue(db);
    (sendBankTransferEmail as Mock).mockRejectedValue(
      new Error("RESEND_API_KEY is not configured"),
    );

    await expect(applyTransition("bk-1", "confirm")).rejects.toThrow(
      "RESEND_API_KEY",
    );

    expect(db._set).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "requested" }),
    );
  });

  it("throws when bank details are not configured", async () => {
    const db = makeMockDb();
    (getDb as Mock).mockReturnValue(db);
    vi.mocked(hasBankDetails).mockReturnValue(false);

    await expect(applyTransition("bk-1", "confirm")).rejects.toThrow(
      "Bank details must be configured",
    );
  });

  it("throws when dates conflict with existing booking", async () => {
    const db = makeMockDb();
    (getDb as Mock).mockReturnValue(db);
    (isRangeAvailable as Mock).mockResolvedValue(false);

    await expect(applyTransition("bk-1", "confirm")).rejects.toThrow(
      "conflict",
    );
  });

  it("sends the bank details straight from settings", async () => {
    const db = makeMockDb();
    (getDb as Mock).mockReturnValue(db);

    await applyTransition("bk-1", "confirm");

    expect(sendBankTransferEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        bankDetails: {
          iban: mockSettings.iban,
          bankName: mockSettings.bank_name,
          accountHolder: mockSettings.account_holder,
        },
      }),
    );
  });

  it("prices the email from the price frozen on the booking request, not live settings", async () => {
    const db = makeMockDb();
    (getDb as Mock).mockReturnValue(db);

    await applyTransition("bk-1", "confirm");

    const nights = calculateTotalNights(
      baseBooking.startDate,
      baseBooking.endDate,
    );
    const expected = calculatePriceBreakdown(
      Number(baseBooking.shownPriceAtBooking),
      nights,
      baseBooking.guestCount,
    );

    expect(sendBankTransferEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        price: {
          nights,
          discount: expected.discount,
          totalPrice: expected.totalPrice,
        },
      }),
    );

    // Sanity check that the settings price (999) never leaks in.
    const settingsBasedTotal = calculatePriceBreakdown(
      mockSettings.price_per_night,
      nights,
      baseBooking.guestCount,
    ).totalPrice;
    expect(expected.totalPrice).not.toBe(settingsBasedTotal);
  });

  it("re-prices from the updated shownPriceAtBooking when the nightly price changed since submission", async () => {
    const changedPriceBooking = { ...baseBooking, shownPriceAtBooking: "250" };
    const db = makeMockDb([changedPriceBooking]);
    (getDb as Mock).mockReturnValue(db);

    await applyTransition("bk-1", "confirm");

    const nights = calculateTotalNights(
      changedPriceBooking.startDate,
      changedPriceBooking.endDate,
    );
    const expected = calculatePriceBreakdown(
      250,
      nights,
      changedPriceBooking.guestCount,
    );

    expect(sendBankTransferEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        price: expect.objectContaining({ totalPrice: expected.totalPrice }),
      }),
    );
  });
});

describe("applyTransition — decline", () => {
  it("updates DB status to declined, sends no email", async () => {
    const db = makeMockDb();
    (getDb as Mock).mockReturnValue(db);

    await applyTransition("bk-1", "decline");

    expect(db._set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "declined" }),
    );
    expect(sendBankTransferEmail).not.toHaveBeenCalled();
  });
});

describe("applyTransition — mark_deposit_paid (two-stage)", () => {
  it("moves on_hold to deposit_paid without touching the snapshot, sends the deposit-received email", async () => {
    const row = { ...baseBooking, status: "on_hold", ...twoStageSnapshot };
    const db = makeMockDb([row]);
    (getDb as Mock).mockReturnValue(db);

    await applyTransition("bk-1", "mark_deposit_paid");

    expect(db._set).toHaveBeenCalledWith({ status: "deposit_paid" });
    expect(sendBankTransferEmail).not.toHaveBeenCalled();
    expect(sendDepositReceivedEmail).toHaveBeenCalledOnce();
    expect(sendDepositReceivedEmail).toHaveBeenCalledWith({
      guest: { name: baseBooking.name, email: baseBooking.email },
      startDate: baseBooking.startDate,
      endDate: baseBooking.endDate,
      locale: baseBooking.locale,
      schedule: { balanceAmount: 500, balanceDeadline: "2027-08-25" },
      securityDeposit: 200,
      bankDetails: {
        iban: mockSettings.iban,
        bankName: mockSettings.bank_name,
        accountHolder: mockSettings.account_holder,
      },
    });
  });

  it("rolls back to on_hold when the deposit-received email fails to send", async () => {
    const row = { ...baseBooking, status: "on_hold", ...twoStageSnapshot };
    const db = makeMockDb([row]);
    (getDb as Mock).mockReturnValue(db);
    (sendDepositReceivedEmail as Mock).mockRejectedValue(
      new Error("SMTP down"),
    );

    await expect(applyTransition("bk-1", "mark_deposit_paid")).rejects.toThrow(
      "SMTP down",
    );

    expect(db._set).toHaveBeenCalledTimes(2);
    expect(db._set).toHaveBeenLastCalledWith({ status: "on_hold" });
  });

  it("throws without touching the DB when bank details are missing", async () => {
    const row = { ...baseBooking, status: "on_hold", ...twoStageSnapshot };
    const db = makeMockDb([row]);
    (getDb as Mock).mockReturnValue(db);
    vi.mocked(hasBankDetails).mockReturnValue(false);

    await expect(applyTransition("bk-1", "mark_deposit_paid")).rejects.toThrow(
      "Bank details must be configured",
    );
    expect(db._set).not.toHaveBeenCalled();
  });

  it("throws when the booking has no two-stage snapshot (lifecycle bug guard)", async () => {
    const row = { ...baseBooking, status: "on_hold", ...collapsedSnapshot };
    const db = makeMockDb([row]);
    (getDb as Mock).mockReturnValue(db);

    await expect(applyTransition("bk-1", "mark_deposit_paid")).rejects.toThrow(
      "lifecycle bug",
    );
    expect(db._set).not.toHaveBeenCalled();
  });
});

describe("applyTransition — mark_balance_paid (two-stage)", () => {
  it("moves deposit_paid to confirmed, sends the balance-received email with the full total", async () => {
    const row = {
      ...baseBooking,
      status: "deposit_paid",
      ...twoStageSnapshot,
    };
    const db = makeMockDb([row]);
    (getDb as Mock).mockReturnValue(db);

    await applyTransition("bk-1", "mark_balance_paid");

    expect(db._set).toHaveBeenCalledWith({ status: "confirmed" });
    expect(sendBalanceReceivedEmail).toHaveBeenCalledWith({
      guest: { name: baseBooking.name, email: baseBooking.email },
      startDate: baseBooking.startDate,
      endDate: baseBooking.endDate,
      locale: baseBooking.locale,
      totalPaid: 800, // 300 deposit + 500 balance (incl. borg)
      securityDeposit: 200,
    });
  });

  it("rolls back to deposit_paid when the balance-received email fails to send", async () => {
    const row = {
      ...baseBooking,
      status: "deposit_paid",
      ...twoStageSnapshot,
    };
    const db = makeMockDb([row]);
    (getDb as Mock).mockReturnValue(db);
    (sendBalanceReceivedEmail as Mock).mockRejectedValue(
      new Error("SMTP down"),
    );

    await expect(applyTransition("bk-1", "mark_balance_paid")).rejects.toThrow(
      "SMTP down",
    );

    expect(db._set).toHaveBeenCalledTimes(2);
    expect(db._set).toHaveBeenLastCalledWith({ status: "deposit_paid" });
  });
});

describe("applyTransition — mark_paid (collapse path)", () => {
  it("moves on_hold straight to confirmed, sends the balance-received email with the single total", async () => {
    const row = { ...baseBooking, status: "on_hold", ...collapsedSnapshot };
    const db = makeMockDb([row]);
    (getDb as Mock).mockReturnValue(db);

    await applyTransition("bk-1", "mark_paid");

    expect(db._set).toHaveBeenCalledWith({ status: "confirmed" });
    expect(sendBankTransferEmail).not.toHaveBeenCalled();
    expect(sendDepositReceivedEmail).not.toHaveBeenCalled();
    expect(sendBalanceReceivedEmail).toHaveBeenCalledWith({
      guest: { name: baseBooking.name, email: baseBooking.email },
      startDate: baseBooking.startDate,
      endDate: baseBooking.endDate,
      locale: baseBooking.locale,
      totalPaid: 833,
      securityDeposit: 200,
    });
  });

  it("rolls back to on_hold when the balance-received email fails to send", async () => {
    const row = { ...baseBooking, status: "on_hold", ...collapsedSnapshot };
    const db = makeMockDb([row]);
    (getDb as Mock).mockReturnValue(db);
    (sendBalanceReceivedEmail as Mock).mockRejectedValue(
      new Error("SMTP down"),
    );

    await expect(applyTransition("bk-1", "mark_paid")).rejects.toThrow(
      "SMTP down",
    );

    expect(db._set).toHaveBeenCalledTimes(2);
    expect(db._set).toHaveBeenLastCalledWith({ status: "on_hold" });
  });
});

describe("applyTransition — cancel", () => {
  it("updates on_hold booking to cancelled", async () => {
    const db = makeMockDb([{ ...baseBooking, status: "on_hold" }]);
    (getDb as Mock).mockReturnValue(db);

    await applyTransition("bk-1", "cancel");

    expect(db._set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "cancelled" }),
    );
  });

  it("updates deposit_paid booking to cancelled", async () => {
    const db = makeMockDb([{ ...baseBooking, status: "deposit_paid" }]);
    (getDb as Mock).mockReturnValue(db);

    await applyTransition("bk-1", "cancel");

    expect(db._set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "cancelled" }),
    );
  });

  it("updates confirmed booking to cancelled", async () => {
    const db = makeMockDb([{ ...baseBooking, status: "confirmed" }]);
    (getDb as Mock).mockReturnValue(db);

    await applyTransition("bk-1", "cancel");

    expect(db._set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "cancelled" }),
    );
  });
});

describe("applyTransition — invalid transitions", () => {
  it("throws for an impossible transition", async () => {
    const db = makeMockDb([{ ...baseBooking, status: "declined" }]);
    (getDb as Mock).mockReturnValue(db);

    await expect(applyTransition("bk-1", "cancel")).rejects.toThrow(
      "Invalid transition",
    );
  });

  it("throws when booking is not found", async () => {
    const db = makeMockDb([]);
    (getDb as Mock).mockReturnValue(db);

    await expect(applyTransition("missing-id", "decline")).rejects.toThrow(
      "Booking not found",
    );
  });
});
