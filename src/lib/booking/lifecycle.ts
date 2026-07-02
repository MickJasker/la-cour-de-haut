import "server-only";
import { getDb } from "@/db";
import { bookingRequest } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  transition,
  type BookingAction,
  type DbBookingStatus,
} from "./machine";
import { getSettings, hasBankDetails } from "@/lib/settings/settings";
import { sendBankTransferEmail, type BankDetails } from "./bank-transfer-email";
import { isRangeAvailable } from "./availability";
import { toUtcDayString } from "./calendar-day";
import {
  calculatePriceBreakdown,
  calculateTotalNights,
} from "@/app/[locale]/book/shared";

export type ApplyTransitionOpts = {
  paymentDeadline?: string;
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

export async function applyTransition(
  bookingId: string,
  action: BookingAction,
  opts: ApplyTransitionOpts = {},
): Promise<void> {
  const booking = await fetchBooking(bookingId);

  // Only "confirm" ever needs bank details (for the bank-transfer email);
  // captured here, narrowed by hasBankDetails, so the email call below never
  // has to fall back to a non-null assertion.
  let bankDetails: BankDetails | undefined;

  if (action === "confirm") {
    const { paymentDeadline } = opts;
    const today = toUtcDayString();
    if (
      !paymentDeadline ||
      !/^\d{4}-\d{2}-\d{2}$/.test(paymentDeadline) ||
      paymentDeadline < today
    ) {
      throw new Error("Payment deadline must be today or in the future");
    }
    // Upper bound: a hold with a deadline after check-in makes no sense —
    // the guest would still be "paying" for a stay that has already started.
    // The confirm dialog clamps this client-side for UX, but that clamp is
    // not a guard against a crafted action call, so it's enforced here too.
    if (paymentDeadline > booking.startDate) {
      throw new Error(
        "Payment deadline must be on or before the check-in date",
      );
    }
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
  }

  const result = transition(booking.status as DbBookingStatus, action);

  const db = getDb();
  await db
    .update(bookingRequest)
    .set({
      status: result.nextStatus,
      ...(action === "confirm" && {
        confirmedAt: new Date(),
        paymentDeadline: opts.paymentDeadline,
      }),
    })
    .where(eq(bookingRequest.id, bookingId));

  // blockInFeed / releaseFromFeed: availability is computed from DB status, so
  // the update above already blocks or releases dates seen via
  // isRangeAvailable / getBookedDays. A future integration (e.g. push to an
  // external calendar) would go here.

  if (result.sideEffects.sendBankTransferEmail) {
    if (!bankDetails) {
      // sendBankTransferEmail is only a side effect of "confirm", which
      // always populates bankDetails above before reaching this point.
      throw new Error(
        "Bank details not resolved for bank-transfer email — this indicates a lifecycle bug, not a user error",
      );
    }
    // Price snapshot: render the amount frozen on the booking request at
    // submit time (shownPriceAtBooking), not live settings — matches what
    // the admin inbox already shows, so guest and owner never disagree on
    // the total even if the nightly price changed after the request.
    const nights = calculateTotalNights(booking.startDate, booking.endDate);
    const { discount, totalPrice } = calculatePriceBreakdown(
      Number(booking.shownPriceAtBooking),
      nights,
      booking.guestCount,
    );
    try {
      await sendBankTransferEmail({
        guest: { name: booking.name, email: booking.email },
        startDate: booking.startDate,
        endDate: booking.endDate,
        guestCount: booking.guestCount,
        paymentDeadline: opts.paymentDeadline!,
        locale: booking.locale,
        price: { nights, discount, totalPrice },
        bankDetails,
      });
    } catch (err) {
      // Compensate: restore original status so the transition looks un-applied
      // from the admin's perspective and can be retried. This is also the
      // rollback path for an unconfigured email transport (see
      // bank-transfer-email.ts) — a confirm must never report success
      // without the instructions actually being sent.
      await db
        .update(bookingRequest)
        .set({
          status: booking.status as DbBookingStatus,
          ...(action === "confirm" && {
            confirmedAt: null,
            paymentDeadline: null,
          }),
        })
        .where(eq(bookingRequest.id, bookingId));
      throw err;
    }
  }
}
