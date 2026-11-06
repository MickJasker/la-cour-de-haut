"use client";
import { useActionState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  declineBookingAction,
  markDepositPaidBookingAction,
  markBalancePaidBookingAction,
  markPaidBookingAction,
  cancelBookingAction,
  type TransitionActionState,
} from "./actions";
import { ConfirmDialog, type ConfirmSchedulePreview } from "./confirm-dialog";
import type { DisplayStatus } from "@/lib/booking/machine";

type Props = {
  bookingId: string;
  guestName: string;
  displayStatus: DisplayStatus;
  bankDetailsConfigured: boolean;
  /**
   * Whether the frozen schedule is a single collapsed payment. Null for a
   * booking with no snapshot yet (legacy on_hold seeded directly) — treated
   * as collapsed, matching the ADR-0021 backfill rule, so it gets the single
   * mark-paid action.
   */
  paymentCollapsed: boolean | null;
  schedulePreview: ConfirmSchedulePreview;
};

export function BookingActions({
  bookingId,
  guestName,
  displayStatus,
  bankDetailsConfigured,
  paymentCollapsed,
  schedulePreview,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [actionState, runAction, isRunning] = useActionState(
    (
      _prev: TransitionActionState | null,
      fn: (id: string) => Promise<TransitionActionState>,
    ) => fn(bookingId),
    null,
  );

  function action(fn: (id: string) => Promise<TransitionActionState>) {
    startTransition(() => runAction(fn));
  }

  const error = actionState?.ok === false ? actionState.error : null;
  const errorLine = error && (
    <p role="alert" className="max-w-xs text-right text-xs text-red-600">
      {error}
    </p>
  );

  const busy = isPending || isRunning;

  if (displayStatus === "requested") {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex gap-2">
          {bankDetailsConfigured ? (
            <ConfirmDialog
              bookingId={bookingId}
              guestName={guestName}
              schedulePreview={schedulePreview}
            />
          ) : (
            <div title="Stel bankgegevens in via Instellingen voor bevestiging">
              <Button size="sm" disabled>
                Bevestigen
              </Button>
            </div>
          )}
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => action(declineBookingAction)}
          >
            Afwijzen
          </Button>
        </div>
        {errorLine}
      </div>
    );
  }

  // An expired hold takes the same actions: a late payment is recorded like
  // an on-time one, and the server refuses it if the dates were taken since.
  if (displayStatus === "on_hold" || displayStatus === "expired") {
    // A collapsed booking (or a legacy hold with no snapshot) is a single
    // payment → confirmed. A two-stage booking marks the deposit first.
    const isCollapsed = paymentCollapsed !== false;
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={busy}
            onClick={() =>
              action(
                isCollapsed
                  ? markPaidBookingAction
                  : markDepositPaidBookingAction,
              )
            }
          >
            {isCollapsed ? "Betaald markeren" : "Aanbetaling markeren"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => action(cancelBookingAction)}
          >
            Annuleren
          </Button>
        </div>
        {errorLine}
      </div>
    );
  }

  if (displayStatus === "deposit_paid") {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={busy}
            onClick={() => action(markBalancePaidBookingAction)}
          >
            Restbetaling markeren
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => action(cancelBookingAction)}
          >
            Annuleren
          </Button>
        </div>
        {errorLine}
      </div>
    );
  }

  if (displayStatus === "confirmed") {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => action(cancelBookingAction)}
        >
          Annuleren
        </Button>
        {errorLine}
      </div>
    );
  }

  return null;
}
