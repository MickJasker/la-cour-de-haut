import "server-only";
import { getDb } from "@/db";
import { bookingRequest } from "@/db/schema";
import { eq } from "drizzle-orm";
import { updateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { isExpiredHold, type DbBookingStatus } from "./machine";
import {
  getSettings,
  hasBankDetails,
  paymentScheduleSettings,
  securityDepositAmount,
} from "@/lib/settings/settings";
import { sendBankTransferEmail, type BankDetails } from "./bank-transfer-email";
import { sendDepositReceivedEmail } from "./deposit-received-email";
import { sendBalanceReceivedEmail } from "./balance-received-email";
import { sendCancellationEmail } from "./cancellation-email";
import { sendDeclineEmail } from "./decline-email";
import { isRangeAvailable } from "./availability";
import { toUtcDayString } from "./calendar-day";
import {
  computePaymentSchedule,
  scheduleToSnapshot,
  bookingPaymentSchedule,
  scheduleTotal,
  type ScheduleSnapshot,
} from "./payment-schedule";
import {
  calculatePriceBreakdown,
  calculateTotalNights,
} from "@/app/[locale]/book/shared";

type Booking = typeof bookingRequest.$inferSelect;

export type BookingAction =
  | "confirm"
  | "decline"
  | "mark_deposit_paid"
  | "mark_balance_paid"
  | "mark_paid"
  | "cancel";

/** Why a transition was refused. Expected owner-facing outcomes, not bugs. */
export type TransitionFailure =
  "invalid_transition" | "dates_taken" | "bank_details_missing";

export type TransitionResult =
  { ok: true } | { ok: false; reason: TransitionFailure };

interface Refusal {
  refused: TransitionFailure;
}

/**
 * What a transition resolves before anything is written: the transactional
 * email to send, and (for `confirm` only) the payment schedule to freeze.
 * Resolving first means a precondition failure aborts before any DB write.
 */
interface Prepared {
  send: () => Promise<void>;
  frozenSchedule?: ScheduleSnapshot;
}

interface TransitionSpec {
  nextStatus: DbBookingStatus;
  prepare: (booking: Booking) => Promise<Prepared | Refusal>;
}

const guestOf = (b: Booking) => ({ name: b.name, email: b.email });
const stayOf = (b: Booking) => ({
  guest: guestOf(b),
  startDate: b.startDate,
  endDate: b.endDate,
  locale: b.locale,
});

// An expired hold already released its dates (ADR-0004), so a late payment
// may only revive it if nothing else has claimed them since. Expired holds
// are excluded from busy intervals, so the booking never conflicts with
// itself; an on-time payment still holds its dates and skips the check.
async function latePaymentRefusal(booking: Booking): Promise<Refusal | null> {
  if (
    isExpiredHold(booking) &&
    !(await isRangeAvailable(booking.startDate, booking.endDate))
  ) {
    return { refused: "dates_taken" };
  }
  return null;
}

async function prepareConfirm(booking: Booking): Promise<Prepared | Refusal> {
  const [settings, available] = await Promise.all([
    getSettings(),
    isRangeAvailable(booking.startDate, booking.endDate),
  ]);
  if (!hasBankDetails(settings)) return { refused: "bank_details_missing" };
  const bankDetails: BankDetails = {
    iban: settings.iban,
    bankName: settings.bank_name,
    accountHolder: settings.account_holder,
  };
  if (!available) return { refused: "dates_taken" };

  // Price snapshot: compute from the price frozen on the booking request at
  // submit time (shownPriceAtBooking), not live settings — so guest and
  // owner never disagree on the total even if the nightly price changed
  // after the request.
  const nights = calculateTotalNights(booking.startDate, booking.endDate);
  const { discount, totalPrice } = calculatePriceBreakdown(
    Number(booking.shownPriceAtBooking),
    nights,
    booking.guestCount,
  );

  // Freeze the two-stage payment schedule at confirm time (ADR-0021): the
  // deadlines derive from the confirm date + the guest's arrival, and the
  // amounts from the frozen total + the current borg. Later settings edits
  // never touch an in-flight booking.
  const securityDeposit = securityDepositAmount(settings);
  const schedule = computePaymentSchedule(
    totalPrice,
    securityDeposit,
    toUtcDayString(),
    booking.startDate,
    paymentScheduleSettings(settings),
  );

  return {
    frozenSchedule: scheduleToSnapshot(schedule, securityDeposit),
    send: () =>
      sendBankTransferEmail({
        ...stayOf(booking),
        guestCount: booking.guestCount,
        price: { nights, discount, totalPrice },
        schedule,
        securityDeposit,
        bankDetails,
      }),
  };
}

async function prepareDepositPaid(
  booking: Booking,
): Promise<Prepared | Refusal> {
  const late = await latePaymentRefusal(booking);
  if (late) return late;
  // The deposit-received receipt restates the balance leg + repeats bank
  // details (ADR-0021). mark_deposit_paid only ever
  // reaches a booking with a two-stage snapshot: a collapsed booking goes
  // on_hold → confirmed directly via mark_paid, and a legacy NULL-snapshot
  // row (never ran the ADR-0021 backfill) is treated as collapsed by the
  // same convention — the admin UI offers neither of them this action.
  // Reaching here with anything but a two-stage snapshot is a lifecycle
  // bug, not a user error, and aborts before any DB write.
  const bookingSchedule = bookingPaymentSchedule(booking);
  if (!bookingSchedule || bookingSchedule.collapsed) {
    throw new Error(
      "Booking has no two-stage payment schedule (collapsed and legacy NULL-snapshot rows take mark_paid instead) — mark_deposit_paid indicates a lifecycle bug, not a user error",
    );
  }
  const settings = await getSettings();
  if (!hasBankDetails(settings)) return { refused: "bank_details_missing" };
  return {
    send: () =>
      sendDepositReceivedEmail({
        ...stayOf(booking),
        schedule: {
          balanceAmount: bookingSchedule.balanceAmount,
          balanceDeadline: bookingSchedule.balanceDeadline,
        },
        securityDeposit: Number(booking.securityDepositAtBooking ?? 0),
        bankDetails: {
          iban: settings.iban,
          bankName: settings.bank_name,
          accountHolder: settings.account_holder,
        },
      }),
  };
}

// Balance-received receipt: payment complete, fires on both the two-stage
// balance leg and the collapsed single mark-paid.
//
// A row with no snapshot is a legacy booking that never ran the ADR-0021
// backfill. Per the backfill's honor-what-was-emailed rule it is treated
// as a collapsed single payment, derived exactly as the SQL backfill
// derives it: the full total the guest was quoted (from the frozen
// shownPriceAtBooking via calculatePriceBreakdown), borg €0. The receipt
// must still go out — a legacy row never bricks the transition, and the
// email is never silently skipped.
function prepareBalanceReceived(booking: Booking): Prepared {
  const bookingSchedule = bookingPaymentSchedule(booking);
  let totalPaid: number;
  let securityDeposit: number;
  if (bookingSchedule) {
    totalPaid = scheduleTotal(bookingSchedule);
    securityDeposit = Number(booking.securityDepositAtBooking ?? 0);
  } else {
    const nights = calculateTotalNights(booking.startDate, booking.endDate);
    totalPaid = calculatePriceBreakdown(
      Number(booking.shownPriceAtBooking),
      nights,
      booking.guestCount,
    ).totalPrice;
    securityDeposit = 0;
  }
  return {
    send: () =>
      sendBalanceReceivedEmail({
        ...stayOf(booking),
        totalPaid,
        securityDeposit,
      }),
  };
}

// Cancellation notice: fires from on_hold, deposit_paid, or confirmed
// — including an expired on_hold, whose row is still on_hold in
// the DB (expired is only a derived display status). The guest already
// missed their deadline but still hears the booking is cancelled.
const prepareCancel = async (booking: Booking): Promise<Prepared> => ({
  send: () => sendCancellationEmail(stayOf(booking)),
});

const prepareDecline = async (booking: Booking): Promise<Prepared> => ({
  send: () => sendDeclineEmail(stayOf(booking)),
});

// The one place the booking state machine is defined. Private: callers go
// through applyTransition, which enforces it. Availability is computed from DB
// status (isRangeAvailable / getBookedDays), so the status write itself blocks
// or releases dates — there is no separate feed step.
const TRANSITIONS: Record<
  DbBookingStatus,
  Partial<Record<BookingAction, TransitionSpec>>
> = {
  requested: {
    confirm: { nextStatus: "on_hold", prepare: prepareConfirm },
    decline: { nextStatus: "declined", prepare: prepareDecline },
  },
  on_hold: {
    // Two-stage path: the deposit has landed, balance + borg still due.
    mark_deposit_paid: {
      nextStatus: "deposit_paid",
      prepare: prepareDepositPaid,
    },
    // Collapse path (short notice, ADR-0021): the single 100% + borg payment
    // has landed, so the hold goes straight to confirmed. The admin UI only
    // offers this action for a collapsed snapshot.
    mark_paid: {
      nextStatus: "confirmed",
      prepare: async (booking) => {
        return (
          (await latePaymentRefusal(booking)) ?? prepareBalanceReceived(booking)
        );
      },
    },
    cancel: { nextStatus: "cancelled", prepare: prepareCancel },
  },
  deposit_paid: {
    mark_balance_paid: {
      nextStatus: "confirmed",
      prepare: async (booking) => prepareBalanceReceived(booking),
    },
    cancel: { nextStatus: "cancelled", prepare: prepareCancel },
  },
  confirmed: {
    cancel: { nextStatus: "cancelled", prepare: prepareCancel },
  },
  declined: {},
  cancelled: {},
};

async function fetchBooking(id: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(bookingRequest)
    .where(eq(bookingRequest.id, id));
  if (!row) throw new Error("Booking not found");
  return row;
}

// The empty snapshot written on rollback — undoes the confirm's frozen
// schedule so a retried confirm starts clean.
const EMPTY_SNAPSHOT = {
  paymentCollapsed: null,
  depositAmount: null,
  paymentDeadline: null,
  balanceAmount: null,
  balanceDeadline: null,
  securityDepositAtBooking: null,
} as const;

/**
 * Applies a booking action: the single gate for every status change.
 *
 * Refusals (returned as `{ ok: false, reason }`, before any DB write or email):
 * - `invalid_transition` — `action` isn't valid from the booking's status
 * - `dates_taken` — `confirm`, or a late `mark_paid` / `mark_deposit_paid` on
 *   an expired hold, whose dates are no longer free
 * - `bank_details_missing` — `confirm` / `mark_deposit_paid` need bank details
 *   in settings for the guest email
 *
 * Still thrown: a missing booking, lifecycle bugs, and email-transport
 * failures (after rollback, see below).
 *
 * Post-conditions on success:
 * - status is the transition's next status; `confirm` also stamps
 *   `confirmedAt` and freezes the payment schedule (ADR-0021)
 * - the guest has been sent the transition's transactional email
 * - the cached iCal export feed is invalidated (`updateTag`, ADR-0024), which
 *   makes this callable from Server Actions only
 *
 * The email is sent synchronously. If sending fails, the status (and for
 * `confirm`, the frozen schedule) is rolled back and the error rethrown, so a
 * transition never reports success without the email going out and the owner
 * can simply retry. The feed is invalidated on that path too, since it may
 * have been regenerated while the new status was briefly written. The status
 * write and the send are not atomic (neon-http has no interactive
 * transactions): a crash between them leaves the new status with no email —
 * accepted, see ADR-0026.
 */
export async function applyTransition(
  bookingId: string,
  action: BookingAction,
): Promise<TransitionResult> {
  const booking = await fetchBooking(bookingId);
  const status = booking.status as DbBookingStatus;

  const spec = TRANSITIONS[status]?.[action];
  if (!spec) return { ok: false, reason: "invalid_transition" };

  const prepared = await spec.prepare(booking);
  if ("refused" in prepared) return { ok: false, reason: prepared.refused };
  const { send, frozenSchedule } = prepared;

  const db = getDb();
  try {
    await db
      .update(bookingRequest)
      .set({
        status: spec.nextStatus,
        ...(frozenSchedule && { confirmedAt: new Date(), ...frozenSchedule }),
      })
      .where(eq(bookingRequest.id, bookingId));

    try {
      await send();
    } catch (err) {
      // Compensate so the transition looks un-applied and can be retried.
      // Only a transition that froze a schedule has more than the status to
      // undo. This is also the rollback path for an unconfigured transport.
      await db
        .update(bookingRequest)
        .set({
          status,
          ...(frozenSchedule && { confirmedAt: null, ...EMPTY_SNAPSHOT }),
        })
        .where(eq(bookingRequest.id, bookingId));
      throw err;
    }
  } finally {
    updateTag(CACHE_TAGS.icalExport);
  }
  return { ok: true };
}
