export type DbBookingStatus =
  | "requested"
  | "on_hold"
  | "confirmed"
  | "declined"
  | "cancelled";

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

export function toDisplayStatus(row: {
  status: DbBookingStatus;
  paymentDeadline: string | null;
}): DisplayStatus {
  if (
    row.status === "on_hold" &&
    row.paymentDeadline !== null &&
    row.paymentDeadline < new Date().toISOString().slice(0, 10)
  ) {
    return "expired";
  }
  return row.status;
}
