"use client";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  declineBookingAction,
  markPaidBookingAction,
  cancelBookingAction,
} from "./actions";
import { ConfirmDialog } from "./confirm-dialog";
import type { DisplayStatus } from "@/lib/booking-machine";

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
          <div title="Configure bank details in Settings before confirming">
            <Button size="sm" disabled>
              Confirm
            </Button>
          </div>
        )}
        <Button
          size="sm"
          variant="secondary"
          disabled={isPending}
          onClick={() => action(declineBookingAction)}
        >
          Decline
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
          Mark paid
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={isPending}
          onClick={() => action(cancelBookingAction)}
        >
          Cancel
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
        Cancel
      </Button>
    );
  }

  return null;
}
