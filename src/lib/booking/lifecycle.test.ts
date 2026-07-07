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
vi.mock("./availability", () => ({ isRangeAvailable: vi.fn() }));

import { getDb } from "@/db";
import {
  getSettings,
  hasBankDetails,
  paymentScheduleSettings,
  securityDepositAmount,
} from "@/lib/settings/settings";
import { sendBankTransferEmail } from "./bank-transfer-email";
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
});

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

describe("applyTransition — mark_deposit_paid / mark_balance_paid (two-stage)", () => {
  it("moves on_hold to deposit_paid without touching the snapshot or emailing", async () => {
    const db = makeMockDb([{ ...baseBooking, status: "on_hold" }]);
    (getDb as Mock).mockReturnValue(db);

    await applyTransition("bk-1", "mark_deposit_paid");

    expect(db._set).toHaveBeenCalledWith({ status: "deposit_paid" });
    expect(sendBankTransferEmail).not.toHaveBeenCalled();
  });

  it("moves deposit_paid to confirmed on mark_balance_paid", async () => {
    const db = makeMockDb([{ ...baseBooking, status: "deposit_paid" }]);
    (getDb as Mock).mockReturnValue(db);

    await applyTransition("bk-1", "mark_balance_paid");

    expect(db._set).toHaveBeenCalledWith({ status: "confirmed" });
  });
});

describe("applyTransition — mark_paid (collapse path)", () => {
  it("moves on_hold straight to confirmed", async () => {
    const db = makeMockDb([{ ...baseBooking, status: "on_hold" }]);
    (getDb as Mock).mockReturnValue(db);

    await applyTransition("bk-1", "mark_paid");

    expect(db._set).toHaveBeenCalledWith({ status: "confirmed" });
    expect(sendBankTransferEmail).not.toHaveBeenCalled();
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
