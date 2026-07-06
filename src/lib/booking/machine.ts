import { toUtcDayString } from "./calendar-day";

export type DbBookingStatus =
  "requested" | "on_hold" | "confirmed" | "declined" | "cancelled";

export type DisplayStatus = DbBookingStatus | "expired";

export type BookingAction = "confirm" | "decline" | "mark_paid" | "cancel";

export interface TransitionResult {
  nextStatus: DbBookingStatus;
  sideEffects: {
    sendBankTransferEmail?: true;
    releaseFromFeed?: true;
    blockInFeed?: true;
  };
}

const TRANSITIONS: Record<
  DbBookingStatus,
  Partial<Record<BookingAction, TransitionResult>>
> = {
  requested: {
    confirm: {
      nextStatus: "on_hold",
      sideEffects: { sendBankTransferEmail: true, blockInFeed: true },
    },
    decline: {
      nextStatus: "declined",
      sideEffects: {},
    },
  },
  on_hold: {
    mark_paid: {
      nextStatus: "confirmed",
      sideEffects: {},
    },
    cancel: {
      nextStatus: "cancelled",
      sideEffects: { releaseFromFeed: true },
    },
  },
  confirmed: {
    cancel: {
      nextStatus: "cancelled",
      sideEffects: { releaseFromFeed: true },
    },
  },
  declined: {},
  cancelled: {},
};

export function transition(
  status: DbBookingStatus,
  action: BookingAction,
): TransitionResult {
  const result = TRANSITIONS[status]?.[action];
  if (!result) {
    throw new Error(
      `Invalid transition: cannot '${action}' a booking with status '${status}'`,
    );
  }
  return result;
}

export function canTransition(
  status: DbBookingStatus,
  action: BookingAction,
): boolean {
  return Boolean(TRANSITIONS[status]?.[action]);
}

/**
 * ADR-0004: an on_hold booking is expired once its payment deadline has
 * passed. This is the single predicate for hold expiry — every surface that
 * needs to know whether a hold still blocks dates (busy-interval queries,
 * display status, dashboard categorisation) calls this instead of
 * re-deriving the date comparison itself.
 *
 * `today` defaults to the real current date; tests should pass a fixed
 * value to make the boundary deterministic.
 */
export function isExpiredHold(
  booking: { status: string; paymentDeadline: string | null },
  today: string = toUtcDayString(),
): boolean {
  return (
    booking.status === "on_hold" &&
    booking.paymentDeadline !== null &&
    booking.paymentDeadline < today
  );
}

export function toDisplayStatus(
  row: { status: DbBookingStatus; paymentDeadline: string | null },
  today?: string,
): DisplayStatus {
  if (isExpiredHold(row, today)) {
    return "expired";
  }
  return row.status;
}
