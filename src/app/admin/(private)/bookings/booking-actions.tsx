"use client";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  declineBookingAction,
  markPaidBookingAction,
  cancelBookingAction,
} from "./actions";
import { ConfirmDialog } from "./confirm-dialog";
import type { DisplayStatus } from "@/lib/booking/machine";

type Props = {
  bookingId: string;
  guestName: string;
  displayStatus: DisplayStatus;
  bankDetailsConfigured: boolean;
  defaultDeadlineDays: number;
  checkInDate: string;
};

export function BookingActions({
  bookingId,
  guestName,
  displayStatus,
  bankDetailsConfigured,
  defaultDeadlineDays,
  checkInDate,
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
            defaultDeadlineDays={defaultDeadlineDays}
            checkInDate={checkInDate}
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
    return (
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={isPending}
          onClick={() => action(markPaidBookingAction)}
        >
          Betaald markeren
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
