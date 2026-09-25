import { toUtcDayString } from "./calendar-day";

export type DbBookingStatus =
  | "requested"
  | "on_hold"
  | "deposit_paid"
  | "confirmed"
  | "declined"
  | "cancelled";

/**
 * The DB enum plus the values that are *computed* at read time and never
 * stored (ADR-0004's lazy philosophy — no cron, no migration):
 *
 * - `expired` — an `on_hold` booking past its payment deadline.
 * - `past` — a `confirmed` booking whose guest has already checked out.
 */
export type DisplayStatus = DbBookingStatus | "expired" | "past";

export type BookingAction =
  | "confirm"
  | "decline"
  | "mark_deposit_paid"
  | "mark_balance_paid"
  | "mark_paid"
  | "cancel";

export interface TransitionResult {
  nextStatus: DbBookingStatus;
  sideEffects: {
    sendBankTransferEmail?: true;
    /** Deposit-received receipt (ADR-0021 wave 3, issue #164). */
    sendDepositReceivedEmail?: true;
    /** Balance-received receipt — both the two-stage balance leg and the
     * collapsed single mark-paid land here (issue #164). */
    sendBalanceReceivedEmail?: true;
    /** Cancellation notice — fires from any of the three active statuses
     * cancel is valid from (issue #165). No refund/amount talk; that stays
     * off-platform. */
    sendCancellationEmail?: true;
    /** Decline notice sent to a guest whose fresh request wasn't accepted
     * (issue #165). Today declined guests hear nothing at all. */
    sendDeclineEmail?: true;
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
      sideEffects: { sendDeclineEmail: true },
    },
  },
  on_hold: {
    // Two-stage path: the deposit has landed, balance + borg still due.
    mark_deposit_paid: {
      nextStatus: "deposit_paid",
      sideEffects: { sendDepositReceivedEmail: true },
    },
    // Collapse path (short notice, ADR-0021): the single 100% + borg payment
    // has landed, so the hold goes straight to confirmed. The admin UI only
    // offers this action for a collapsed snapshot; two-stage bookings use
    // mark_deposit_paid instead.
    mark_paid: {
      nextStatus: "confirmed",
      sideEffects: { sendBalanceReceivedEmail: true },
    },
    cancel: {
      nextStatus: "cancelled",
      sideEffects: { releaseFromFeed: true, sendCancellationEmail: true },
    },
  },
  deposit_paid: {
    mark_balance_paid: {
      nextStatus: "confirmed",
      sideEffects: { sendBalanceReceivedEmail: true },
    },
    cancel: {
      nextStatus: "cancelled",
      sideEffects: { releaseFromFeed: true, sendCancellationEmail: true },
    },
  },
  confirmed: {
    cancel: {
      nextStatus: "cancelled",
      sideEffects: { releaseFromFeed: true, sendCancellationEmail: true },
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

/**
 * The gîte's own time zone. Checkout happens on the property's clock — not
 * the server's (UTC on Vercel) and not the viewer's — so the one comparison
 * in the booking area that needs a real time of day anchors itself here.
 */
const PROPERTY_TIME_ZONE = "Europe/Paris";

/** Checkout time on `endDate`, as a property-local `HH:mm` wall clock. */
const CHECKOUT_WALL_CLOCK = "12:00";

const propertyWallClockFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: PROPERTY_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/**
 * Renders an instant as the property's local wall clock, in the
 * lexicographically sortable `YYYY-MM-DDTHH:mm` shape.
 *
 * Letting `Intl` do the conversion means DST comes from the platform's tz
 * database instead of hand-rolled offset arithmetic: 10:00 UTC reads as 11:00
 * in Paris winter (CET, UTC+1) and 12:00 in Paris summer (CEST, UTC+2), and
 * the switch date moves with the zone, not with our code.
 */
function toPropertyWallClock(instant: Date): string {
  const parts: Record<string, string> = {};
  for (const { type, value } of propertyWallClockFormat.formatToParts(
    instant,
  )) {
    parts[type] = value;
  }
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/**
 * Whether the guest has checked out — true from 12:00 Europe/Paris on
 * `endDate` onwards.
 *
 * `endDate` is the *exclusive* checkout day (RFC 5545 convention, used
 * everywhere in this codebase), so the stay ends on the morning of `endDate`
 * and midday is the owner's cutoff for "the gîte is empty again".
 *
 * Unlike every other date check in the booking area (`isExpiredHold`,
 * `computeDashboard`), this is a genuine instant comparison rather than a
 * plain `YYYY-MM-DD` compare: a stay ending today is still current at 09:00
 * and over at 13:00. Both sides are expressed as fixed-width property-local
 * wall-clock strings, so a lexicographic `>=` is a chronological one.
 *
 * `now` defaults to the real current instant; tests pass a fixed Date to make
 * the boundary deterministic.
 */
export function isPastCheckout(
  endDate: string,
  now: Date = new Date(),
): boolean {
  return toPropertyWallClock(now) >= `${endDate}T${CHECKOUT_WALL_CLOCK}`;
}

export function toDisplayStatus(
  row: {
    status: DbBookingStatus;
    paymentDeadline: string | null;
    endDate: string;
  },
  today?: string,
  now?: Date,
): DisplayStatus {
  if (isExpiredHold(row, today)) {
    return "expired";
  }
  // Only `confirmed` ages into `past`. A `deposit_paid` booking whose balance
  // never landed must keep reading as unpaid however long ago the guest left:
  // relabelling it "past" would bury an open debt the owner is still chasing
  // (it also still needs to surface through the dashboard's overdue flag).
  if (row.status === "confirmed" && isPastCheckout(row.endDate, now)) {
    return "past";
  }
  return row.status;
}
