"use client";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  declineBookingAction,
  markDepositPaidBookingAction,
  markBalancePaidBookingAction,
  markPaidBookingAction,
  cancelBookingAction,
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

  function action(fn: (id: string) => Promise<void>) {
    startTransition(() => fn(bookingId));
  }

  if (displayStatus === "requested") {
    return (
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
          disabled={isPending}
          onClick={() => action(declineBookingAction)}
        >
          Afwijzen
        </Button>
      </div>
    );
  }

  if (displayStatus === "on_hold") {
    // A collapsed booking (or a legacy hold with no snapshot) is a single
    // payment → confirmed. A two-stage booking marks the deposit first.
    const isCollapsed = paymentCollapsed !== false;
    return (
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={isPending}
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
          disabled={isPending}
          onClick={() => action(cancelBookingAction)}
        >
          Annuleren
        </Button>
      </div>
    );
  }

  if (displayStatus === "deposit_paid") {
    return (
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={isPending}
          onClick={() => action(markBalancePaidBookingAction)}
        >
          Restbetaling markeren
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={isPending}
          onClick={() => action(cancelBookingAction)}
        >
          Annuleren
        </Button>
      </div>
    );
  }

  if (displayStatus === "confirmed") {
    return (
      <Button
        size="sm"
        variant="secondary"
        disabled={isPending}
        onClick={() => action(cancelBookingAction)}
      >
        Annuleren
      </Button>
    );
  }

  return null;
}
