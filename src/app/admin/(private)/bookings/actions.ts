"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { bookingRequest } from "@/db/schema";
import { verifySession } from "@/lib/auth/session";
import {
  applyTransition,
  type BookingAction,
  type TransitionFailure,
} from "@/lib/booking/lifecycle";
import { isDeletableBooking } from "@/lib/booking/machine";

export type TransitionActionState = { ok: true } | { ok: false; error: string };

const FAILURE_MESSAGES: Record<TransitionFailure, string> = {
  invalid_transition:
    "Deze actie is niet meer mogelijk voor deze boeking. Ververs de pagina.",
  dates_taken:
    "Deze datums zijn inmiddels bezet (boeking, blokkade of platform). Controleer de beschikbaarheidskalender.",
  bank_details_missing:
    "Stel eerst bankgegevens in via Instellingen om de e-mail naar de gast te kunnen versturen.",
};

async function run(
  id: string,
  action: BookingAction,
): Promise<TransitionActionState> {
  await verifySession();
  // applyTransition owns the iCal feed invalidation (ADR-0024); this layer
  // only refreshes the admin page.
  const result = await applyTransition(id, action);
  if (!result.ok) return { ok: false, error: FAILURE_MESSAGES[result.reason] };
  revalidatePath("/admin/bookings");
  return { ok: true };
}

// The payment schedule (deadlines + amounts) is derived from settings + the
// confirm date inside applyTransition and frozen onto the booking — the owner
// no longer picks a deadline. See ADR-0021.
export async function confirmBookingAction(id: string) {
  return run(id, "confirm");
}

export async function declineBookingAction(id: string) {
  return run(id, "decline");
}

/** Two-stage path: the deposit landed; balance + borg still due before arrival. */
export async function markDepositPaidBookingAction(id: string) {
  return run(id, "mark_deposit_paid");
}

/** Two-stage path: the balance (incl. borg) landed → confirmed. */
export async function markBalancePaidBookingAction(id: string) {
  return run(id, "mark_balance_paid");
}

/** Collapse path: the single 100% + borg payment landed → confirmed. */
export async function markPaidBookingAction(id: string) {
  return run(id, "mark_paid");
}

export async function cancelBookingAction(id: string) {
  return run(id, "cancel");
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

/**
 * Hard-delete a dead booking (declined / cancelled / expired hold). This is
 * record removal, not a lifecycle transition (see ADR-0029): no emails, no
 * feed side effects, hence outside `applyTransition`. Eligibility is re-derived
 * from the DB row against a fresh `today` — the client's displayed status is
 * never trusted.
 */
export async function deleteBookingAction(
  id: string,
): Promise<TransitionActionState> {
  await verifySession();
  const db = getDb();
  const [row] = await db
    .select({
      status: bookingRequest.status,
      paymentDeadline: bookingRequest.paymentDeadline,
    })
    .from(bookingRequest)
    .where(eq(bookingRequest.id, id))
    .limit(1);
  if (!row || !isDeletableBooking(row)) {
    return {
      ok: false,
      error:
        "Deze boeking kan niet verwijderd worden. Alleen afgewezen, geannuleerde of verlopen boekingen kunnen verwijderd worden. Ververs de pagina.",
    };
  }
  await db.delete(bookingRequest).where(eq(bookingRequest.id, id));
  revalidatePath("/admin/bookings");
  return { ok: true };
}
