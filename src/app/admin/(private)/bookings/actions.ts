"use server";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { bookingRequest } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifySession } from "@/lib/dal";
import { transition, type DbBookingStatus } from "@/lib/booking-machine";
import { getSettings } from "@/lib/settings";
import { sendBankTransferEmail } from "@/lib/bank-transfer-email";

async function fetchBooking(id: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(bookingRequest)
    .where(eq(bookingRequest.id, id));
  if (!row) throw new Error("Booking not found");
  return row;
}

export async function confirmBookingAction(
  id: string,
  paymentDeadline: string,
) {
  await verifySession();
  const booking = await fetchBooking(id);
  const result = transition(booking.status as DbBookingStatus, "confirm");

  const db = getDb();
  await db
    .update(bookingRequest)
    .set({
      status: result.nextStatus,
      confirmedAt: new Date(),
      paymentDeadline,
    })
    .where(eq(bookingRequest.id, id));

  if (result.sideEffects.sendBankTransferEmail) {
    const settings = await getSettings();
    void sendBankTransferEmail({
      guest: { name: booking.name, email: booking.email },
      startDate: booking.startDate,
      endDate: booking.endDate,
      guestCount: booking.guestCount,
      paymentDeadline,
      locale: booking.locale,
      settings,
    }).catch(console.error);
  }

  revalidatePath("/admin/bookings");
}

export async function declineBookingAction(id: string) {
  await verifySession();
  const booking = await fetchBooking(id);
  const result = transition(booking.status as DbBookingStatus, "decline");
  const db = getDb();
  await db
    .update(bookingRequest)
    .set({ status: result.nextStatus })
    .where(eq(bookingRequest.id, id));
  revalidatePath("/admin/bookings");
}

export async function markPaidBookingAction(id: string) {
  await verifySession();
  const booking = await fetchBooking(id);
  const result = transition(booking.status as DbBookingStatus, "mark_paid");
  const db = getDb();
  await db
    .update(bookingRequest)
    .set({ status: result.nextStatus })
    .where(eq(bookingRequest.id, id));
  revalidatePath("/admin/bookings");
}

export async function cancelBookingAction(id: string) {
  await verifySession();
  const booking = await fetchBooking(id);
  const result = transition(booking.status as DbBookingStatus, "cancel");
  const db = getDb();
  await db
    .update(bookingRequest)
    .set({ status: result.nextStatus })
    .where(eq(bookingRequest.id, id));
  revalidatePath("/admin/bookings");
}

export async function updateOwnerNotesAction(id: string, notes: string) {
  await verifySession();
  const db = getDb();
  await db
    .update(bookingRequest)
    .set({ ownerNotes: notes })
    .where(eq(bookingRequest.id, id));
  revalidatePath("/admin/bookings");
}
