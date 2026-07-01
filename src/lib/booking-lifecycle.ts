import "server-only";
import { getDb } from "@/db";
import { bookingRequest } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  transition,
  type BookingAction,
  type DbBookingStatus,
} from "./booking-machine";
import { getSettings, hasBankDetails } from "./settings";
import { sendBankTransferEmail } from "./bank-transfer-email";
import { isRangeAvailable } from "./availability";

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

  let settings: Awaited<ReturnType<typeof getSettings>> | undefined;

  if (action === "confirm") {
    const { paymentDeadline } = opts;
    const today = new Date().toISOString().slice(0, 10);
    if (
      !paymentDeadline ||
      !/^\d{4}-\d{2}-\d{2}$/.test(paymentDeadline) ||
      paymentDeadline < today
    ) {
      throw new Error("Payment deadline must be today or in the future");
    }
    let available: boolean;
    [settings, available] = await Promise.all([
      getSettings(),
      isRangeAvailable(booking.startDate, booking.endDate),
    ]);
    if (!hasBankDetails(settings)) {
      throw new Error(
        "Bank details must be configured before confirming a booking",
      );
    }
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
    settings ??= await getSettings();
    try {
      await sendBankTransferEmail({
        guest: { name: booking.name, email: booking.email },
        startDate: booking.startDate,
        endDate: booking.endDate,
        guestCount: booking.guestCount,
        paymentDeadline: opts.paymentDeadline!,
        locale: booking.locale,
        settings,
      });
    } catch (err) {
      // Compensate: restore original status so the transition looks un-applied
      // from the admin's perspective and can be retried.
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
