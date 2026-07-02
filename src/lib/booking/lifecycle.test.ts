import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import {
  calculatePriceBreakdown,
  calculateTotalNights,
} from "@/app/[locale]/book/shared";

vi.mock("@/db", () => ({ getDb: vi.fn() }));
vi.mock("@/db/schema", () => ({ bookingRequest: {} }));
vi.mock("drizzle-orm", () => ({ eq: vi.fn() }));
vi.mock("@/lib/settings", () => ({
  getSettings: vi.fn(),
  hasBankDetails: vi.fn(),
}));
vi.mock("./bank-transfer-email", () => ({
  sendBankTransferEmail: vi.fn(),
}));
vi.mock("./availability", () => ({ isRangeAvailable: vi.fn() }));

import { getDb } from "@/db";
import { getSettings, hasBankDetails } from "@/lib/settings";
import { sendBankTransferEmail } from "./bank-transfer-email";
import { isRangeAvailable } from "./availability";
import { applyTransition } from "./lifecycle";

// Booking runs 2027-09-01 → 2027-09-07 (6 nights). Deadlines below are
// chosen relative to that window: VALID_DEADLINE sits strictly inside
// [today, check-in], AFTER_CHECKIN_DATE sits just past check-in.
const VALID_DEADLINE = "2027-08-25";
const AFTER_CHECKIN_DATE = "2027-09-15";
const PAST_DATE = "2000-01-01";

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

const mockSettings = {
  iban: "NL91ABNA0417164300",
  bank_name: "Test Bank",
  account_holder: "La Cour de Haut",
  // Deliberately different from shownPriceAtBooking — if this leaks into
  // the email total, the price-snapshot tests below will catch it.
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

beforeEach(() => {
  vi.clearAllMocks();
  (getSettings as Mock).mockResolvedValue(mockSettings);
  // hasBankDetails is a type predicate at the type level, so it can't be
  // widened to `Mock` via `as` — vi.mocked() preserves its real signature.
  vi.mocked(hasBankDetails).mockReturnValue(true);
  (isRangeAvailable as Mock).mockResolvedValue(true);
  (sendBankTransferEmail as Mock).mockResolvedValue(undefined);
});

describe("applyTransition — confirm", () => {
  it("updates DB status to on_hold and sends bank transfer email", async () => {
    const db = makeMockDb();
    (getDb as Mock).mockReturnValue(db);

    await applyTransition("bk-1", "confirm", {
      paymentDeadline: VALID_DEADLINE,
    });

    expect(db._set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "on_hold" }),
    );
    expect(sendBankTransferEmail).toHaveBeenCalledOnce();
    expect(sendBankTransferEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentDeadline: VALID_DEADLINE,
        guest: { name: baseBooking.name, email: baseBooking.email },
      }),
    );
  });

  it("surfaces bank transfer email errors — not fire-and-forget", async () => {
    const db = makeMockDb();
    (getDb as Mock).mockReturnValue(db);
    (sendBankTransferEmail as Mock).mockRejectedValue(new Error("SMTP down"));

    await expect(
      applyTransition("bk-1", "confirm", { paymentDeadline: VALID_DEADLINE }),
    ).rejects.toThrow("SMTP down");
  });

  it("rolls back DB status when email send fails", async () => {
    const db = makeMockDb();
    (getDb as Mock).mockReturnValue(db);
    (sendBankTransferEmail as Mock).mockRejectedValue(new Error("SMTP down"));

    await expect(
      applyTransition("bk-1", "confirm", { paymentDeadline: VALID_DEADLINE }),
    ).rejects.toThrow("SMTP down");

    // Second _set call should restore original status
    expect(db._set).toHaveBeenCalledTimes(2);
    expect(db._set).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "requested" }),
    );
  });

  it("rolls back DB status when the email transport is unconfigured (same policy as any other send failure)", async () => {
    const db = makeMockDb();
    (getDb as Mock).mockReturnValue(db);
    (sendBankTransferEmail as Mock).mockRejectedValue(
      new Error("RESEND_API_KEY is not configured"),
    );

    await expect(
      applyTransition("bk-1", "confirm", { paymentDeadline: VALID_DEADLINE }),
    ).rejects.toThrow("RESEND_API_KEY");

    expect(db._set).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "requested" }),
    );
  });

  it("throws when paymentDeadline is missing", async () => {
    const db = makeMockDb();
    (getDb as Mock).mockReturnValue(db);

    await expect(applyTransition("bk-1", "confirm", {})).rejects.toThrow(
      "Payment deadline must be today or in the future",
    );
  });

  it("throws when paymentDeadline is in the past", async () => {
    const db = makeMockDb();
    (getDb as Mock).mockReturnValue(db);

    await expect(
      applyTransition("bk-1", "confirm", { paymentDeadline: PAST_DATE }),
    ).rejects.toThrow("Payment deadline must be today or in the future");
  });

  it("throws when paymentDeadline is after the check-in date", async () => {
    const db = makeMockDb();
    (getDb as Mock).mockReturnValue(db);

    await expect(
      applyTransition("bk-1", "confirm", {
        paymentDeadline: AFTER_CHECKIN_DATE,
      }),
    ).rejects.toThrow(
      "Payment deadline must be on or before the check-in date",
    );
    expect(sendBankTransferEmail).not.toHaveBeenCalled();
    expect(db._set).not.toHaveBeenCalled();
  });

  it("accepts a paymentDeadline equal to the check-in date (inclusive upper bound)", async () => {
    const db = makeMockDb();
    (getDb as Mock).mockReturnValue(db);

    await applyTransition("bk-1", "confirm", {
      paymentDeadline: baseBooking.startDate,
    });

    expect(db._set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "on_hold" }),
    );
  });

  it("throws when bank details are not configured", async () => {
    const db = makeMockDb();
    (getDb as Mock).mockReturnValue(db);
    vi.mocked(hasBankDetails).mockReturnValue(false);

    await expect(
      applyTransition("bk-1", "confirm", { paymentDeadline: VALID_DEADLINE }),
    ).rejects.toThrow("Bank details must be configured");
  });

  it("throws when dates conflict with existing booking", async () => {
    const db = makeMockDb();
    (getDb as Mock).mockReturnValue(db);
    (isRangeAvailable as Mock).mockResolvedValue(false);

    await expect(
      applyTransition("bk-1", "confirm", { paymentDeadline: VALID_DEADLINE }),
    ).rejects.toThrow("conflict");
  });

  it("sends the bank details straight from settings", async () => {
    const db = makeMockDb();
    (getDb as Mock).mockReturnValue(db);

    await applyTransition("bk-1", "confirm", {
      paymentDeadline: VALID_DEADLINE,
    });

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

    await applyTransition("bk-1", "confirm", {
      paymentDeadline: VALID_DEADLINE,
    });

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

    // Sanity check that the settings price (999) never leaks in — if it
    // did, this assertion's expected total would differ.
    const settingsBasedTotal = calculatePriceBreakdown(
      mockSettings.price_per_night,
      nights,
      baseBooking.guestCount,
    ).totalPrice;
    expect(expected.totalPrice).not.toBe(settingsBasedTotal);
  });

  it("re-prices from the updated shownPriceAtBooking when the nightly price changed since submission", async () => {
    const changedPriceBooking = {
      ...baseBooking,
      shownPriceAtBooking: "250",
    };
    const db = makeMockDb([changedPriceBooking]);
    (getDb as Mock).mockReturnValue(db);

    await applyTransition("bk-1", "confirm", {
      paymentDeadline: VALID_DEADLINE,
    });

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

describe("applyTransition — mark_paid", () => {
  it("updates on_hold booking to confirmed", async () => {
    const db = makeMockDb([{ ...baseBooking, status: "on_hold" }]);
    (getDb as Mock).mockReturnValue(db);

    await applyTransition("bk-1", "mark_paid");

    expect(db._set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "confirmed" }),
    );
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
