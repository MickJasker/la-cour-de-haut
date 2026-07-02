"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { bookingRequest } from "@/db/schema";
import { verifySession } from "@/lib/dal";
import { applyTransition } from "@/lib/booking/lifecycle";

export async function confirmBookingAction(
  id: string,
  paymentDeadline: string,
) {
  await verifySession();
  await applyTransition(id, "confirm", { paymentDeadline });
  revalidatePath("/admin/bookings");
}

export async function declineBookingAction(id: string) {
  await verifySession();
  await applyTransition(id, "decline");
  revalidatePath("/admin/bookings");
}

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
