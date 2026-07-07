/**
 * The two-stage payment schedule (issue #162): a deposit due shortly after
 * confirmation, and the balance plus security deposit (borg) due before
 * arrival.
 *
 * `computePaymentSchedule` is the SINGLE source of truth for the schedule —
 * the confirm transition, the bank-transfer email, and the public
 * booking-form breakdown all consume its output, so the collapse rule and
 * cent rounding live in exactly one place (same single-predicate philosophy
 * as `isExpiredHold`, ADR-0004).
 *
 * Deliberately has no `server-only` import: like `calendar-day.ts`, it must
 * be shareable by server modules and client components alike.
 */

/**
 * The owner-configurable knobs of the schedule, as plain numbers. Read from
 * the `setting` table via `paymentScheduleSettings()` in
 * `src/lib/settings/settings.ts`; defined here so the pure function owns its
 * input contract.
 */
export interface PaymentScheduleSettings {
  /** Percentage of the total due as the deposit (1–100). */
  depositPercentage: number;
  /** Days after confirmation that the deposit is due. */
  depositDeadlineDays: number;
  /** Days before arrival that the balance (incl. borg) is due. */
  balanceDueDaysBeforeArrival: number;
}

export type PaymentSchedule =
  | {
      collapsed: false;
      /** EUR, rounded to cents. */
      depositAmount: number;
      /** UTC day string (YYYY-MM-DD): confirm + depositDeadlineDays. */
      depositDeadline: string;
      /** Remainder of the total plus the borg, in EUR. */
      balanceAmount: number;
      /** UTC day string (YYYY-MM-DD): arrival − balanceDueDaysBeforeArrival. */
      balanceDeadline: string;
    }
  | {
      /**
       * Short notice: the balance deadline would fall on or before the
       * deposit deadline, so the schedule collapses to one payment of
       * 100% + borg.
       */
      collapsed: true;
      /** EUR: the full total plus the borg. */
      totalAmount: number;
      /**
       * UTC day string (YYYY-MM-DD): confirm + depositDeadlineDays, but
       * never later than the day before arrival.
       */
      deadline: string;
    };

/** Day arithmetic on YYYY-MM-DD strings, UTC-safe (noon avoids DST edges). */
function addDays(dayString: string, days: number): string {
  const d = new Date(dayString + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const toCents = (eur: number) => Math.round(eur * 100);
const fromCents = (cents: number) => cents / 100;

/**
 * @param total - Total rental price in EUR (excl. borg).
 * @param securityDeposit - The borg: a fixed EUR amount, refunded after the
 *   stay, always charged with the final payment.
 * @param confirmDate - UTC day string (YYYY-MM-DD) the owner confirms.
 * @param arrivalDate - UTC day string (YYYY-MM-DD) of check-in.
 */
export function computePaymentSchedule(
  total: number,
  securityDeposit: number,
  confirmDate: string,
  arrivalDate: string,
  settings: PaymentScheduleSettings,
): PaymentSchedule {
  const depositDeadline = addDays(confirmDate, settings.depositDeadlineDays);
  const balanceDeadline = addDays(
    arrivalDate,
    -settings.balanceDueDaysBeforeArrival,
  );

  const totalCents = toCents(total);
  const borgCents = toCents(securityDeposit);

  // Collapse rule (short notice): a balance deadline on or before the
  // deposit deadline leaves no room for two payments — everything is due at
  // once, within depositDeadlineDays but never later than the day before
  // arrival. ISO day strings compare correctly as plain strings.
  if (balanceDeadline <= depositDeadline) {
    const dayBeforeArrival = addDays(arrivalDate, -1);
    return {
      collapsed: true,
      totalAmount: fromCents(totalCents + borgCents),
      deadline:
        depositDeadline <= dayBeforeArrival
          ? depositDeadline
          : dayBeforeArrival,
    };
  }

  // Deposit is rounded to whole cents; the balance takes the remainder, so
  // the two payments always sum to exactly total + borg.
  const depositCents = Math.round(
    (totalCents * settings.depositPercentage) / 100,
  );

  return {
    collapsed: false,
    depositAmount: fromCents(depositCents),
    depositDeadline,
    balanceAmount: fromCents(totalCents - depositCents + borgCents),
    balanceDeadline,
  };
}
