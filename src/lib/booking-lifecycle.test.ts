import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("@/db", () => ({ getDb: vi.fn() }));
vi.mock("@/db/schema", () => ({ bookingRequest: {} }));
vi.mock("drizzle-orm", () => ({ eq: vi.fn() }));
vi.mock("./settings", () => ({
  getSettings: vi.fn(),
  hasBankDetails: vi.fn(),
}));
vi.mock("./bank-transfer-email", () => ({
  sendBankTransferEmail: vi.fn(),
}));
vi.mock("./availability", () => ({ isRangeAvailable: vi.fn() }));

import { getDb } from "@/db";
import { getSettings, hasBankDetails } from "./settings";
import { sendBankTransferEmail } from "./bank-transfer-email";
import { isRangeAvailable } from "./availability";
import { applyTransition } from "./booking-lifecycle";

const FUTURE_DATE = "2099-01-01";

const baseBooking = {
  id: "bk-1",
  name: "Anna Schmidt",
  email: "anna@example.com",
  guestCount: 2,
  locale: "de",
  startDate: "2027-09-01",
  endDate: "2027-09-07",
  status: "requested",
};

const mockSettings = { iban: "NL91ABNA0417164300" };

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
  (hasBankDetails as Mock).mockReturnValue(true);
  (isRangeAvailable as Mock).mockResolvedValue(true);
  (sendBankTransferEmail as Mock).mockResolvedValue(undefined);
});

describe("applyTransition — confirm", () => {
  it("updates DB status to on_hold and sends bank transfer email", async () => {
    const db = makeMockDb();
    (getDb as Mock).mockReturnValue(db);

    await applyTransition("bk-1", "confirm", { paymentDeadline: FUTURE_DATE });

    expect(db._set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "on_hold" }),
    );
    expect(sendBankTransferEmail).toHaveBeenCalledOnce();
    expect(sendBankTransferEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentDeadline: FUTURE_DATE,
        guest: { name: baseBooking.name, email: baseBooking.email },
      }),
    );
  });

  it("surfaces bank transfer email errors — not fire-and-forget", async () => {
    const db = makeMockDb();
    (getDb as Mock).mockReturnValue(db);
    (sendBankTransferEmail as Mock).mockRejectedValue(new Error("SMTP down"));

    await expect(
      applyTransition("bk-1", "confirm", { paymentDeadline: FUTURE_DATE }),
    ).rejects.toThrow("SMTP down");
  });

  it("rolls back DB status when email send fails", async () => {
    const db = makeMockDb();
    (getDb as Mock).mockReturnValue(db);
    (sendBankTransferEmail as Mock).mockRejectedValue(new Error("SMTP down"));

    await expect(
      applyTransition("bk-1", "confirm", { paymentDeadline: FUTURE_DATE }),
    ).rejects.toThrow("SMTP down");

    // Second _set call should restore original status
    expect(db._set).toHaveBeenCalledTimes(2);
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
      applyTransition("bk-1", "confirm", { paymentDeadline: "2000-01-01" }),
    ).rejects.toThrow("Payment deadline must be today or in the future");
  });

  it("throws when bank details are not configured", async () => {
    const db = makeMockDb();
    (getDb as Mock).mockReturnValue(db);
    (hasBankDetails as Mock).mockReturnValue(false);

    await expect(
      applyTransition("bk-1", "confirm", { paymentDeadline: FUTURE_DATE }),
    ).rejects.toThrow("Bank details must be configured");
  });

  it("throws when dates conflict with existing booking", async () => {
    const db = makeMockDb();
    (getDb as Mock).mockReturnValue(db);
    (isRangeAvailable as Mock).mockResolvedValue(false);

    await expect(
      applyTransition("bk-1", "confirm", { paymentDeadline: FUTURE_DATE }),
    ).rejects.toThrow("conflict");
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
