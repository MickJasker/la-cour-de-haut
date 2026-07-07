import "server-only";
import { getDb } from "@/db";
import { bookingRequest } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  transition,
  type BookingAction,
  type DbBookingStatus,
} from "./machine";
import {
  getSettings,
  hasBankDetails,
  paymentScheduleSettings,
  securityDepositAmount,
} from "@/lib/settings/settings";
import { sendBankTransferEmail, type BankDetails } from "./bank-transfer-email";
import { sendDepositReceivedEmail } from "./deposit-received-email";
import { sendBalanceReceivedEmail } from "./balance-received-email";
import { isRangeAvailable } from "./availability";
import { toUtcDayString } from "./calendar-day";
import {
  computePaymentSchedule,
  scheduleToSnapshot,
  bookingPaymentSchedule,
  scheduleTotal,
  type PaymentSchedule,
  type ScheduleSnapshot,
} from "./payment-schedule";
import {
  calculatePriceBreakdown,
  calculateTotalNights,
} from "@/app/[locale]/book/shared";

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

export async function applyTransition(
  bookingId: string,
  action: BookingAction,
): Promise<void> {
  const booking = await fetchBooking(bookingId);

  // Only "confirm" freezes the payment schedule and needs bank details (for
  // the bank-transfer email). Both are captured here so the email call below
  // never has to fall back to a non-null assertion.
  let bankDetails: BankDetails | undefined;
  let schedule: PaymentSchedule | undefined;
  let snapshot: ScheduleSnapshot | undefined;
  let securityDeposit = 0;
  let price:
    { nights: number; discount: number; totalPrice: number } | undefined;
  let depositReceivedParams:
    Parameters<typeof sendDepositReceivedEmail>[0] | undefined;
  let balanceReceivedParams:
    Parameters<typeof sendBalanceReceivedEmail>[0] | undefined;

  if (action === "mark_deposit_paid") {
    // The deposit-received receipt restates the balance leg + repeats bank
    // details (ADR-0021 wave 3, issue #164). mark_deposit_paid only ever
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
    if (!hasBankDetails(settings)) {
      throw new Error(
        "Bank details must be configured to send the deposit-received email",
      );
    }
    depositReceivedParams = {
      guest: { name: booking.name, email: booking.email },
      startDate: booking.startDate,
      endDate: booking.endDate,
      locale: booking.locale,
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
    };
  }

  if (action === "mark_balance_paid" || action === "mark_paid") {
    // Balance-received receipt: payment complete, fires on both the
    // two-stage balance leg and the collapsed single mark-paid.
    //
    // A row with no snapshot is a legacy booking that never ran the ADR-0021
    // backfill. Per the backfill's honor-what-was-emailed rule it is treated
    // as a collapsed single payment, derived exactly as the SQL backfill
    // derives it: the full total the guest was quoted (from the frozen
    // shownPriceAtBooking via calculatePriceBreakdown), borg €0. The receipt
    // must still go out — a legacy row never bricks the transition, and the
    // email is never silently skipped.
    const bookingSchedule = bookingPaymentSchedule(booking);
    let totalPaid: number;
    let borgPaid: number;
    if (bookingSchedule) {
      totalPaid = scheduleTotal(bookingSchedule);
      borgPaid = Number(booking.securityDepositAtBooking ?? 0);
    } else {
      const nights = calculateTotalNights(booking.startDate, booking.endDate);
      totalPaid = calculatePriceBreakdown(
        Number(booking.shownPriceAtBooking),
        nights,
        booking.guestCount,
      ).totalPrice;
      borgPaid = 0;
    }
    balanceReceivedParams = {
      guest: { name: booking.name, email: booking.email },
      startDate: booking.startDate,
      endDate: booking.endDate,
      locale: booking.locale,
      totalPaid,
      securityDeposit: borgPaid,
    };
  }

  if (action === "confirm") {
    const [settings, available] = await Promise.all([
      getSettings(),
      isRangeAvailable(booking.startDate, booking.endDate),
    ]);
    if (!hasBankDetails(settings)) {
      throw new Error(
        "Bank details must be configured before confirming a booking",
      );
    }
    bankDetails = {
      iban: settings.iban,
      bankName: settings.bank_name,
      accountHolder: settings.account_holder,
    };
    if (!available) {
      throw new Error(
        "These dates conflict with an existing booking or platform hold. Check the availability calendar before confirming.",
      );
    }

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
    price = { nights, discount, totalPrice };

    // Freeze the two-stage payment schedule at confirm time (ADR-0021): the
    // deadlines derive from the confirm date + the guest's arrival, and the
    // amounts from the frozen total + the current borg. Later settings edits
    // never touch an in-flight booking.
    securityDeposit = securityDepositAmount(settings);
    schedule = computePaymentSchedule(
      totalPrice,
      securityDeposit,
      toUtcDayString(),
      booking.startDate,
      paymentScheduleSettings(settings),
    );
    snapshot = scheduleToSnapshot(schedule, securityDeposit);
  }

  const result = transition(booking.status as DbBookingStatus, action);

  const db = getDb();
  await db
    .update(bookingRequest)
    .set({
      status: result.nextStatus,
      ...(snapshot && {
        confirmedAt: new Date(),
        ...snapshot,
      }),
    })
    .where(eq(bookingRequest.id, bookingId));

  // blockInFeed / releaseFromFeed: availability is computed from DB status, so
  // the update above already blocks or releases dates seen via
  // isRangeAvailable / getBookedDays. A future integration (e.g. push to an
  // external calendar) would go here.

  if (result.sideEffects.sendBankTransferEmail) {
    if (!bankDetails || !schedule || !price) {
      // sendBankTransferEmail is only a side effect of "confirm", which
      // always populates these above before reaching this point.
      throw new Error(
        "Payment schedule not resolved for bank-transfer email — this indicates a lifecycle bug, not a user error",
      );
    }
    try {
      await sendBankTransferEmail({
        guest: { name: booking.name, email: booking.email },
        startDate: booking.startDate,
        endDate: booking.endDate,
        guestCount: booking.guestCount,
        locale: booking.locale,
        price,
        schedule,
        securityDeposit,
        bankDetails,
      });
    } catch (err) {
      // Compensate: restore original status and clear the frozen schedule so
      // the transition looks un-applied from the admin's perspective and can
      // be retried. This is also the rollback path for an unconfigured email
      // transport (see bank-transfer-email.ts) — a confirm must never report
      // success without the instructions actually being sent.
      await db
        .update(bookingRequest)
        .set({
          status: booking.status as DbBookingStatus,
          confirmedAt: null,
          ...EMPTY_SNAPSHOT,
        })
        .where(eq(bookingRequest.id, bookingId));
      throw err;
    }
  }

  if (result.sideEffects.sendDepositReceivedEmail) {
    if (!depositReceivedParams) {
      // Only a side effect of mark_deposit_paid, which always populates this
      // above before reaching this point.
      throw new Error(
        "Deposit-received email params not resolved — this indicates a lifecycle bug, not a user error",
      );
    }
    try {
      await sendDepositReceivedEmail(depositReceivedParams);
    } catch (err) {
      // Same compensating-rollback policy as the bank-transfer email: no
      // status change may be reported as successful without the receipt
      // actually going out. Neither the snapshot nor confirmedAt is touched
      // by this transition, so only the status needs restoring.
      await db
        .update(bookingRequest)
        .set({ status: booking.status as DbBookingStatus })
        .where(eq(bookingRequest.id, bookingId));
      throw err;
    }
  }

  if (result.sideEffects.sendBalanceReceivedEmail) {
    if (!balanceReceivedParams) {
      // Only a side effect of mark_balance_paid / mark_paid, which always
      // populate this above before reaching this point.
      throw new Error(
        "Balance-received email params not resolved — this indicates a lifecycle bug, not a user error",
      );
    }
    try {
      await sendBalanceReceivedEmail(balanceReceivedParams);
    } catch (err) {
      await db
        .update(bookingRequest)
        .set({ status: booking.status as DbBookingStatus })
        .where(eq(bookingRequest.id, bookingId));
      throw err;
    }
  }
}
