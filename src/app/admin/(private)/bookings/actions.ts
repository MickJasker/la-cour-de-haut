"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { bookingRequest } from "@/db/schema";
import { verifySession } from "@/lib/auth/session";
import { applyTransition } from "@/lib/booking/lifecycle";

export async function confirmBookingAction(id: string) {
  await verifySession();
  // The payment schedule (deadlines + amounts) is derived from settings + the
  // confirm date inside applyTransition and frozen onto the booking — the
  // owner no longer picks a deadline. See ADR-0021.
  await applyTransition(id, "confirm");
  revalidatePath("/admin/bookings");
}

export async function declineBookingAction(id: string) {
  await verifySession();
  await applyTransition(id, "decline");
  revalidatePath("/admin/bookings");
}

/** Two-stage path: the deposit landed; balance + borg still due before arrival. */
export async function markDepositPaidBookingAction(id: string) {
  await verifySession();
  await applyTransition(id, "mark_deposit_paid");
  revalidatePath("/admin/bookings");
}

/** Two-stage path: the balance (incl. borg) landed → confirmed. */
export async function markBalancePaidBookingAction(id: string) {
  await verifySession();
  await applyTransition(id, "mark_balance_paid");
  revalidatePath("/admin/bookings");
}

/** Collapse path: the single 100% + borg payment landed → confirmed. */
export async function markPaidBookingAction(id: string) {
  await verifySession();
  await applyTransition(id, "mark_paid");
  revalidatePath("/admin/bookings");
}

export async function cancelBookingAction(id: string) {
  await verifySession();
  await applyTransition(id, "cancel");
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
