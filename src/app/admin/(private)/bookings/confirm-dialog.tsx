"use client";
import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { confirmBookingAction } from "./actions";

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

type Props = {
  bookingId: string;
  guestName: string;
  defaultDeadlineDays: number;
};

export function ConfirmDialog({
  bookingId,
  guestName,
  defaultDeadlineDays,
}: Props) {
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [deadline, setDeadline] = useState(addDays(today, defaultDeadlineDays));
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      await confirmBookingAction(bookingId, deadline);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Confirm</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm booking — {guestName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-stone-600">
            Setting status to <strong>on hold</strong>. Dates will be blocked in
            the export feed and a bank-transfer email will be sent to the guest.
          </p>
          <div className="space-y-1">
            <label
              htmlFor="payment-deadline"
              className="text-sm font-medium text-stone-700"
            >
              Payment deadline
            </label>
            <input
              id="payment-deadline"
              type="date"
              value={deadline}
              min={today}
              onChange={(e) => setDeadline(e.target.value)}
              className="block w-full rounded border border-stone-300 px-3 py-1.5 text-sm focus:border-stone-500 focus:outline-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={isPending}>
            {isPending ? "Confirming…" : "Confirm booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
