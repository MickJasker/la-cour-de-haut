import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  calculatePriceBreakdown,
  calculateTotalNights,
} from "@/app/[locale]/book/shared";
import type { bookingRequest } from "@/db/schema";
import type { Settings } from "@/lib/settings/settings";
import { toUtcDayString } from "./calendar-day";
import { computePaymentSchedule, scheduleToSnapshot } from "./payment-schedule";
import {
  applyTransition as applyTransitionWith,
  type BookingAction,
  type LifecycleDeps,
  type LifecycleStore,
} from "./lifecycle";
import type { DbBookingStatus } from "./machine";

// next/cache is a framework API (updateTag only works inside a Server Action),
// not one of the lifecycle's injected deps.
vi.mock("next/cache", () => ({ updateTag: vi.fn() }));
import { updateTag } from "next/cache";

type Booking = typeof bookingRequest.$inferSelect;

// The injected "now". Fixed so every deadline and `confirmedAt` is exact.
const NOW = new Date("2027-06-01T10:00:00.000Z");
const TODAY = toUtcDayString(NOW); // 2027-06-01

// Booking runs 2027-09-01 → 2027-09-07 (6 nights), far enough past NOW that
// the schedule never collapses.
const baseBooking: Booking = {
  id: "bk-1",
  name: "Anna Schmidt",
  email: "anna@example.com",
  guestCount: 2,
  phone: null,
  address: "Hauptstr. 1",
  postalCode: "10115",
  city: "Berlin",
  country: "DE",
  iban: null,
  locale: "de",
  startDate: "2027-09-01",
  endDate: "2027-09-07",
  message: null,
  status: "requested",
  confirmedAt: null,
  paymentDeadline: null,
  paymentCollapsed: null,
  depositAmount: null,
  balanceAmount: null,
  balanceDeadline: null,
  securityDepositAtBooking: null,
  ownerNotes: null,
  createdAt: new Date("2027-05-01T00:00:00.000Z"),
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

const mockSettings: Settings = {
  iban: "NL91ABNA0417164300",
  bank_name: "Test Bank",
  account_holder: "La Cour de Haut",
  price_per_night: 999,
  security_deposit_amount: BORG,
  deposit_percentage: SCHEDULE_SETTINGS.depositPercentage,
  deposit_deadline_days: SCHEDULE_SETTINGS.depositDeadlineDays,
  balance_due_days_before_arrival:
    SCHEDULE_SETTINGS.balanceDueDaysBeforeArrival,
};

/**
 * In-memory `LifecycleStore`: a real fake, not a faked query-builder chain.
 * Tests assert the resulting row, so a rollback is observable as state.
 */
function makeStore(initial: Booking | undefined) {
  const state = { row: initial && { ...initial }, writes: 0 };
  const store: LifecycleStore = {
    async getBooking() {
      return state.row && { ...state.row };
    },
    async saveTransition(_id, { status, freeze }) {
      state.writes++;
      if (!state.row) throw new Error("no row");
      state.row = {
        ...state.row,
        status,
        ...(freeze && { confirmedAt: freeze.confirmedAt, ...freeze.snapshot }),
      };
    },
    async revertTransition(_id, { status, clearFrozenSchedule }) {
      state.writes++;
      if (!state.row) throw new Error("no row");
      state.row = {
        ...state.row,
        status,
        ...(clearFrozenSchedule && {
          confirmedAt: null,
          paymentCollapsed: null,
          depositAmount: null,
          paymentDeadline: null,
          balanceAmount: null,
          balanceDeadline: null,
          securityDepositAtBooking: null,
        }),
      };
    },
  };
  return { store, state };
}

const sendBankTransferEmail = vi.fn();
const sendDepositReceivedEmail = vi.fn();
const sendBalanceReceivedEmail = vi.fn();
const sendCancellationEmail = vi.fn();
const sendDeclineEmail = vi.fn();
const isRangeAvailable = vi.fn();
const getSettings = vi.fn();

const row = (over: Partial<Booking> = {}): Booking => ({
  ...baseBooking,
  ...over,
});

/** Runs `applyTransition` against an in-memory store holding `initial`. */
function run(
  action: BookingAction,
  initial: Booking | null = baseBooking,
  now: Date = NOW,
) {
  const { store, state } = makeStore(initial ?? undefined);
  const deps: LifecycleDeps = {
    store,
    clock: () => now,
    getSettings,
    isRangeAvailable,
    sendBankTransferEmail,
    sendDepositReceivedEmail,
    sendBalanceReceivedEmail,
    sendCancellationEmail,
    sendDeclineEmail,
  };
  return { state, result: applyTransitionWith("bk-1", action, deps) };
}

/** `applyTransition` that returns the final row alongside the result. */
async function apply(
  action: BookingAction,
  initial?: Booking | null,
  now?: Date,
) {
  const { state, result } = run(action, initial, now);
  return { result: await result, state };
}

/** Same, for transitions expected to throw. */
async function applyRejecting(
  action: BookingAction,
  initial?: Booking | null,
  now?: Date,
) {
  const { state, result } = run(action, initial, now);
  const error = await result.then(
    () => undefined,
    (e: unknown) => e,
  );
  return { error, state };
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
    TODAY,
    baseBooking.startDate,
    SCHEDULE_SETTINGS,
  );
  return { schedule, snapshot: scheduleToSnapshot(schedule, BORG) };
}

beforeEach(() => {
  vi.clearAllMocks();
  getSettings.mockResolvedValue(mockSettings);
  isRangeAvailable.mockResolvedValue(true);
  sendBankTransferEmail.mockResolvedValue(undefined);
  sendDepositReceivedEmail.mockResolvedValue(undefined);
  sendBalanceReceivedEmail.mockResolvedValue(undefined);
  sendCancellationEmail.mockResolvedValue(undefined);
  sendDeclineEmail.mockResolvedValue(undefined);
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

// A legacy row that never ran the ADR-0021 backfill: all snapshot columns
// NULL (as drizzle returns them), e.g. an on_hold seeded before the two-stage
// migration. `bookingPaymentSchedule` returns null for it; the convention is
// to treat it as a collapsed single payment of the full quoted price, borg €0.
const nullSnapshot = {
  paymentCollapsed: null,
  depositAmount: null,
  balanceAmount: null,
  paymentDeadline: "2027-08-10",
  balanceDeadline: null,
  securityDepositAtBooking: null,
};

/** The collapsed total a legacy NULL-snapshot row is treated as having paid:
 * the full quoted price from shownPriceAtBooking — exactly how the ADR-0021
 * SQL backfill derives it. */
function legacyTotalForBase() {
  const nights = calculateTotalNights(
    baseBooking.startDate,
    baseBooking.endDate,
  );
  return calculatePriceBreakdown(
    Number(baseBooking.shownPriceAtBooking),
    nights,
    baseBooking.guestCount,
  ).totalPrice;
}

describe("applyTransition — confirm", () => {
  it("moves the booking to on_hold and sends the bank transfer email", async () => {
    const { result, state } = await apply("confirm");

    expect(result).toEqual({ ok: true });
    expect(state.row?.status).toBe("on_hold");
    expect(sendBankTransferEmail).toHaveBeenCalledOnce();
    expect(sendBankTransferEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        guest: { name: baseBooking.name, email: baseBooking.email },
      }),
    );
  });

  it("freezes the computed payment-schedule snapshot onto the booking", async () => {
    const { state } = await apply("confirm");

    expect(state.row).toMatchObject(expectedForBase().snapshot);
  });

  it("stamps confirmedAt from the injected clock", async () => {
    const { state } = await apply("confirm");

    expect(state.row?.confirmedAt).toEqual(NOW);
  });

  it("passes the frozen schedule and borg to the bank-transfer email", async () => {
    await apply("confirm");

    expect(sendBankTransferEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        schedule: expectedForBase().schedule,
        securityDeposit: BORG,
      }),
    );
  });

  it("surfaces bank transfer email errors — not fire-and-forget", async () => {
    sendBankTransferEmail.mockRejectedValue(new Error("SMTP down"));

    const { error } = await applyRejecting("confirm");

    expect(error).toEqual(new Error("SMTP down"));
  });

  it("rolls back status and clears confirmedAt + the snapshot when the email fails", async () => {
    sendBankTransferEmail.mockRejectedValue(new Error("SMTP down"));

    const { state } = await applyRejecting("confirm");

    // Back to exactly the pre-confirm row: a retried confirm starts clean.
    expect(state.row).toEqual(baseBooking);
    expect(state.writes).toBe(2);
  });

  it("rolls back when the email transport is unconfigured (same policy as any send failure)", async () => {
    sendBankTransferEmail.mockRejectedValue(
      new Error("RESEND_API_KEY is not configured"),
    );

    const { error, state } = await applyRejecting("confirm");

    expect(error).toEqual(new Error("RESEND_API_KEY is not configured"));
    expect(state.row?.status).toBe("requested");
  });

  it("refuses with bank_details_missing, changing and sending nothing", async () => {
    getSettings.mockResolvedValue({ ...mockSettings, iban: undefined });

    const { result, state } = await apply("confirm");

    expect(result).toEqual({ ok: false, reason: "bank_details_missing" });
    expect(state.writes).toBe(0);
    expect(sendBankTransferEmail).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("refuses with dates_taken when dates conflict with an existing booking", async () => {
    isRangeAvailable.mockResolvedValue(false);

    const { result, state } = await apply("confirm");

    expect(result).toEqual({ ok: false, reason: "dates_taken" });
    expect(state.writes).toBe(0);
    expect(sendBankTransferEmail).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("sends the bank details straight from settings", async () => {
    await apply("confirm");

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
    await apply("confirm");

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
      mockSettings.price_per_night!,
      nights,
      baseBooking.guestCount,
    ).totalPrice;
    expect(expected.totalPrice).not.toBe(settingsBasedTotal);
  });

  it("re-prices from the updated shownPriceAtBooking when the nightly price changed since submission", async () => {
    const changed = row({ shownPriceAtBooking: "250" });

    await apply("confirm", changed);

    const nights = calculateTotalNights(changed.startDate, changed.endDate);
    const expected = calculatePriceBreakdown(250, nights, changed.guestCount);

    expect(sendBankTransferEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        price: expect.objectContaining({ totalPrice: expected.totalPrice }),
      }),
    );
  });
});

describe("applyTransition — confirm at the 'today' edge (injected clock)", () => {
  // Deposit is due 3 days after confirm (06-04); the balance is due 7 days
  // before arrival. The schedule collapses to one payment when the balance
  // deadline falls on or before the deposit deadline.
  //   arrival 06-11 → balance due 06-04 (== deposit deadline) → collapsed
  //   arrival 06-12 → balance due 06-05 (>  deposit deadline) → two-stage
  const stay = (startDate: string) =>
    row({ startDate, endDate: addNightsTo(startDate) });
  const addNightsTo = (d: string) => {
    const next = new Date(`${d}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 6);
    return toUtcDayString(next);
  };

  it("collapses when the balance deadline lands exactly on the deposit deadline", async () => {
    const { state } = await apply("confirm", stay("2027-06-11"));

    expect(state.row).toMatchObject({
      paymentCollapsed: true,
      paymentDeadline: "2027-06-04",
    });
  });

  it("stays two-stage one day later", async () => {
    const { state } = await apply("confirm", stay("2027-06-12"));

    expect(state.row).toMatchObject({
      paymentCollapsed: false,
      paymentDeadline: "2027-06-04",
      balanceDeadline: "2027-06-05",
    });
  });

  it("derives the deadlines from the injected clock's day, not the wall clock", async () => {
    // Same booking, confirmed a day later: every deadline shifts by a day.
    const later = new Date("2027-06-02T10:00:00.000Z");

    const { state } = await apply("confirm", stay("2027-06-20"), later);

    expect(state.row?.paymentDeadline).toBe("2027-06-05");
    expect(state.row?.confirmedAt).toEqual(later);
  });
});

describe("applyTransition — decline", () => {
  it("moves the booking to declined and sends the decline email", async () => {
    const { state } = await apply("decline");

    expect(state.row?.status).toBe("declined");
    expect(sendBankTransferEmail).not.toHaveBeenCalled();
    expect(sendDeclineEmail).toHaveBeenCalledExactlyOnceWith({
      guest: { name: baseBooking.name, email: baseBooking.email },
      startDate: baseBooking.startDate,
      endDate: baseBooking.endDate,
      locale: baseBooking.locale,
    });
  });

  it("rolls back to requested when the decline email fails to send", async () => {
    sendDeclineEmail.mockRejectedValue(new Error("SMTP down"));

    const { error, state } = await applyRejecting("decline");

    expect(error).toEqual(new Error("SMTP down"));
    expect(state.row).toEqual(baseBooking);
    expect(state.writes).toBe(2);
  });
});

describe("applyTransition — mark_deposit_paid (two-stage)", () => {
  const onHold = (over: Partial<Booking> = {}) =>
    row({ status: "on_hold", ...twoStageSnapshot, ...over });

  it("moves on_hold to deposit_paid without touching the snapshot, sends the deposit-received email", async () => {
    const { state } = await apply("mark_deposit_paid", onHold());

    expect(state.row).toEqual(onHold({ status: "deposit_paid" }));
    expect(sendBankTransferEmail).not.toHaveBeenCalled();
    expect(sendDepositReceivedEmail).toHaveBeenCalledExactlyOnceWith({
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

  it("rolls back to on_hold, keeping the frozen schedule, when the email fails to send", async () => {
    sendDepositReceivedEmail.mockRejectedValue(new Error("SMTP down"));

    const { error, state } = await applyRejecting(
      "mark_deposit_paid",
      onHold(),
    );

    expect(error).toEqual(new Error("SMTP down"));
    expect(state.row).toEqual(onHold());
    expect(state.writes).toBe(2);
  });

  it("refuses with bank_details_missing without touching the store", async () => {
    getSettings.mockResolvedValue({ ...mockSettings, iban: undefined });

    const { result, state } = await apply("mark_deposit_paid", onHold());

    expect(result).toEqual({ ok: false, reason: "bank_details_missing" });
    expect(state.writes).toBe(0);
  });

  it("throws when the booking has a collapsed snapshot (lifecycle bug guard)", async () => {
    const { error, state } = await applyRejecting(
      "mark_deposit_paid",
      onHold(collapsedSnapshot),
    );

    expect(String(error)).toContain("lifecycle bug");
    expect(state.writes).toBe(0);
  });

  it("throws without writing for a legacy NULL-snapshot row (treated as collapsed, so mark_deposit_paid is never offered)", async () => {
    const { error, state } = await applyRejecting(
      "mark_deposit_paid",
      onHold(nullSnapshot),
    );

    expect(String(error)).toContain("lifecycle bug");
    expect(state.writes).toBe(0);
    expect(sendDepositReceivedEmail).not.toHaveBeenCalled();
  });
});

describe("applyTransition — mark_balance_paid (two-stage)", () => {
  const depositPaid = (over: Partial<Booking> = {}) =>
    row({ status: "deposit_paid", ...twoStageSnapshot, ...over });

  it("moves deposit_paid to confirmed, sends the balance-received email with the full total", async () => {
    const { state } = await apply("mark_balance_paid", depositPaid());

    expect(state.row?.status).toBe("confirmed");
    expect(sendBalanceReceivedEmail).toHaveBeenCalledExactlyOnceWith({
      guest: { name: baseBooking.name, email: baseBooking.email },
      startDate: baseBooking.startDate,
      endDate: baseBooking.endDate,
      locale: baseBooking.locale,
      totalPaid: 800, // 300 deposit + 500 balance (incl. borg)
      securityDeposit: 200,
    });
  });

  it("rolls back to deposit_paid when the balance-received email fails to send", async () => {
    sendBalanceReceivedEmail.mockRejectedValue(new Error("SMTP down"));

    const { error, state } = await applyRejecting(
      "mark_balance_paid",
      depositPaid(),
    );

    expect(error).toEqual(new Error("SMTP down"));
    expect(state.row).toEqual(depositPaid());
    expect(state.writes).toBe(2);
  });

  it("still transitions and emails a legacy NULL-snapshot row, deriving the collapsed total from shownPriceAtBooking with borg €0", async () => {
    const { state } = await apply(
      "mark_balance_paid",
      depositPaid(nullSnapshot),
    );

    expect(state.row?.status).toBe("confirmed");
    expect(sendBalanceReceivedEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        totalPaid: legacyTotalForBase(),
        securityDeposit: 0,
      }),
    );
  });
});

describe("applyTransition — mark_paid (collapse path)", () => {
  const onHold = (over: Partial<Booking> = {}) =>
    row({ status: "on_hold", ...collapsedSnapshot, ...over });

  it("moves on_hold straight to confirmed, sends the balance-received email with the single total", async () => {
    const { state } = await apply("mark_paid", onHold());

    expect(state.row?.status).toBe("confirmed");
    expect(sendBankTransferEmail).not.toHaveBeenCalled();
    expect(sendDepositReceivedEmail).not.toHaveBeenCalled();
    expect(sendBalanceReceivedEmail).toHaveBeenCalledExactlyOnceWith({
      guest: { name: baseBooking.name, email: baseBooking.email },
      startDate: baseBooking.startDate,
      endDate: baseBooking.endDate,
      locale: baseBooking.locale,
      totalPaid: 833,
      securityDeposit: 200,
    });
  });

  it("rolls back to on_hold when the balance-received email fails to send", async () => {
    sendBalanceReceivedEmail.mockRejectedValue(new Error("SMTP down"));

    const { error, state } = await applyRejecting("mark_paid", onHold());

    expect(error).toEqual(new Error("SMTP down"));
    expect(state.row).toEqual(onHold());
    expect(state.writes).toBe(2);
  });

  it("still transitions and emails a legacy NULL-snapshot on_hold row (ADR-0021 backfill convention: collapsed full price, borg €0)", async () => {
    const { state } = await apply("mark_paid", onHold(nullSnapshot));

    expect(state.row?.status).toBe("confirmed");
    expect(sendBalanceReceivedEmail).toHaveBeenCalledExactlyOnceWith({
      guest: { name: baseBooking.name, email: baseBooking.email },
      startDate: baseBooking.startDate,
      endDate: baseBooking.endDate,
      locale: baseBooking.locale,
      totalPaid: legacyTotalForBase(),
      securityDeposit: 0,
    });
  });
});

describe("applyTransition — late payment on an expired hold", () => {
  // Still stored as on_hold; the deposit deadline has passed, so it displays
  // as expired and its dates are already released.
  const EXPIRED_DEADLINE = { paymentDeadline: "2020-01-01" };
  const expiredCollapsed = () =>
    row({ status: "on_hold", ...collapsedSnapshot, ...EXPIRED_DEADLINE });
  const expiredTwoStage = () =>
    row({ status: "on_hold", ...twoStageSnapshot, ...EXPIRED_DEADLINE });

  it("moves an expired collapsed hold to confirmed when the dates are still free", async () => {
    const { state } = await apply("mark_paid", expiredCollapsed());

    expect(isRangeAvailable).toHaveBeenCalledWith(
      baseBooking.startDate,
      baseBooking.endDate,
    );
    expect(state.row?.status).toBe("confirmed");
    expect(sendBalanceReceivedEmail).toHaveBeenCalledOnce();
  });

  it("moves an expired two-stage hold to deposit_paid when the dates are still free, leaving the frozen schedule untouched", async () => {
    const { state } = await apply("mark_deposit_paid", expiredTwoStage());

    expect(isRangeAvailable).toHaveBeenCalledWith(
      baseBooking.startDate,
      baseBooking.endDate,
    );
    expect(state.row).toEqual({ ...expiredTwoStage(), status: "deposit_paid" });
    expect(sendDepositReceivedEmail).toHaveBeenCalledOnce();
  });

  it.each([
    ["mark_paid", expiredCollapsed],
    ["mark_deposit_paid", expiredTwoStage],
  ] as const)(
    "refuses %s with dates_taken and changes nothing when the released dates were taken",
    async (action, make) => {
      isRangeAvailable.mockResolvedValue(false);

      const { result, state } = await apply(action, make());

      expect(result).toEqual({ ok: false, reason: "dates_taken" });
      expect(updateTag).not.toHaveBeenCalled();
      expect(state.writes).toBe(0);
      expect(sendDepositReceivedEmail).not.toHaveBeenCalled();
      expect(sendBalanceReceivedEmail).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["mark_paid", collapsedSnapshot],
    ["mark_deposit_paid", twoStageSnapshot],
  ] as const)(
    "does not run the availability guard for %s on a non-expired on_hold — the hold still owns its dates",
    async (action, snapshot) => {
      // Would refuse if consulted: proves the on-time path never asks.
      isRangeAvailable.mockResolvedValue(false);

      const { state } = await apply(
        action,
        row({ status: "on_hold", ...snapshot, paymentDeadline: "2099-12-31" }),
      );

      expect(isRangeAvailable).not.toHaveBeenCalled();
      expect(state.writes).toBe(1);
    },
  );

  describe("deadline boundary follows the injected clock", () => {
    // isExpiredHold is strictly `deadline < today`: a hold is still valid on
    // its deadline day and expires the day after.
    const holdDue = (paymentDeadline: string) =>
      row({ status: "on_hold", ...collapsedSnapshot, paymentDeadline });

    it("treats a hold due today as still owning its dates", async () => {
      isRangeAvailable.mockResolvedValue(false);

      const { result } = await apply("mark_paid", holdDue(TODAY));

      expect(result).toEqual({ ok: true });
      expect(isRangeAvailable).not.toHaveBeenCalled();
    });

    it("treats a hold due yesterday as expired and re-checks the dates", async () => {
      isRangeAvailable.mockResolvedValue(false);

      const { result } = await apply("mark_paid", holdDue("2027-05-31"));

      expect(result).toEqual({ ok: false, reason: "dates_taken" });
    });

    it("flips from valid to expired as the injected clock crosses midnight", async () => {
      isRangeAvailable.mockResolvedValue(false);
      const nextDay = new Date("2027-06-02T00:00:01.000Z");

      const { result } = await apply("mark_paid", holdDue(TODAY), nextDay);

      expect(result).toEqual({ ok: false, reason: "dates_taken" });
    });
  });
});

describe("applyTransition — cancel", () => {
  it.each(["on_hold", "deposit_paid", "confirmed"] as const)(
    "moves a %s booking to cancelled and sends the cancellation email",
    async (status) => {
      const { state } = await apply("cancel", row({ status }));

      expect(state.row?.status).toBe("cancelled");
      expect(sendCancellationEmail).toHaveBeenCalledExactlyOnceWith({
        guest: { name: baseBooking.name, email: baseBooking.email },
        startDate: baseBooking.startDate,
        endDate: baseBooking.endDate,
        locale: baseBooking.locale,
      });
    },
  );

  it("cancels an expired on_hold booking (still stored as on_hold) and sends the cancellation email — the guest missed the deadline but still hears about the cancellation", async () => {
    const { state } = await apply(
      "cancel",
      row({ status: "on_hold", paymentDeadline: "2020-01-01" }),
    );

    expect(state.row?.status).toBe("cancelled");
    expect(sendCancellationEmail).toHaveBeenCalledOnce();
  });

  it("rolls back to the prior status when the cancellation email fails to send", async () => {
    sendCancellationEmail.mockRejectedValue(new Error("SMTP down"));
    const confirmed = row({ status: "confirmed" });

    const { error, state } = await applyRejecting("cancel", confirmed);

    expect(error).toEqual(new Error("SMTP down"));
    expect(state.row).toEqual(confirmed);
    expect(state.writes).toBe(2);
  });
});

describe("applyTransition — transition table", () => {
  type Case = [DbBookingStatus, BookingAction, DbBookingStatus, object?];
  const validCases: Case[] = [
    ["requested", "confirm", "on_hold"],
    ["requested", "decline", "declined"],
    ["on_hold", "mark_deposit_paid", "deposit_paid", twoStageSnapshot],
    ["on_hold", "mark_paid", "confirmed"],
    ["deposit_paid", "mark_balance_paid", "confirmed", twoStageSnapshot],
    ["on_hold", "cancel", "cancelled"],
    ["deposit_paid", "cancel", "cancelled"],
    ["confirmed", "cancel", "cancelled"],
  ];

  for (const [from, action, to, extra] of validCases) {
    it(`${from} → ${to} on '${action}'`, async () => {
      const { state } = await apply(action, row({ ...extra, status: from }));

      expect(state.row?.status).toBe(to);
    });
  }

  const invalidCases: [DbBookingStatus, BookingAction][] = [
    ["requested", "mark_paid"],
    ["requested", "cancel"],
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

  for (const [from, action] of invalidCases) {
    it(`rejects '${action}' from '${from}' without writing or emailing`, async () => {
      const { result, state } = await apply(action, row({ status: from }));

      expect(result).toEqual({ ok: false, reason: "invalid_transition" });
      expect(state.writes).toBe(0);
      expect(sendBankTransferEmail).not.toHaveBeenCalled();
    });
  }
});

describe("applyTransition — iCal export feed invalidation (ADR-0024)", () => {
  it("invalidates the feed once on success", async () => {
    const { result } = await apply("decline");

    expect(result).toEqual({ ok: true });
    expect(updateTag).toHaveBeenCalledExactlyOnceWith("ical-export");
  });

  it("still invalidates after rolling back a failed send", async () => {
    sendDeclineEmail.mockRejectedValue(new Error("SMTP down"));

    await applyRejecting("decline");

    expect(updateTag).toHaveBeenCalledOnce();
  });

  it("does not invalidate when the transition is refused", async () => {
    await apply("cancel", row({ status: "declined" }));

    expect(updateTag).not.toHaveBeenCalled();
  });
});

describe("applyTransition — missing booking", () => {
  it("throws when the booking is not found", async () => {
    const { error, state } = await applyRejecting("decline", null);

    expect(error).toEqual(new Error("Booking not found"));
    expect(state.writes).toBe(0);
  });
});
