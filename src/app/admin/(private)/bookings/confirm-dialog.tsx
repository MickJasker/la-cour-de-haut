"use client";
import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { confirmBookingAction } from "./actions";
import type { PaymentSchedule } from "@/lib/booking/payment-schedule";

/**
 * The schedule the guest will be emailed on confirm, computed server-side in
 * the bookings page from the frozen price + current settings. Shown read-only
 * here so the owner sees exactly what the guest receives — the owner no longer
 * picks a deadline (ADR-0021). The action re-derives the schedule at confirm
 * time, so a preview rendered a day earlier stays informational, not binding.
 */
export type ConfirmSchedulePreview = {
  schedule: PaymentSchedule;
  securityDeposit: number;
};

const currency = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});
const dateFmt = new Intl.DateTimeFormat("nl-NL", {
  year: "numeric",
  month: "long",
  day: "numeric",
});
const fmtDate = (iso: string) => dateFmt.format(new Date(iso));

type Props = {
  bookingId: string;
  guestName: string;
  schedulePreview: ConfirmSchedulePreview;
};

function SchedulePreview({
  schedule,
  securityDeposit,
}: ConfirmSchedulePreview) {
  const borgLine =
    securityDeposit > 0
      ? ` (incl. ${currency.format(securityDeposit)} borg)`
      : "";

  if (schedule.collapsed) {
    return (
      <div className="rounded border border-stone-200 bg-stone-50 p-3 text-sm">
        <p className="font-medium text-stone-700">Eén betaling{borgLine}</p>
        <p className="text-stone-600">
          {currency.format(schedule.totalAmount)} — vóór{" "}
          {fmtDate(schedule.deadline)}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 text-sm">
      <div className="rounded border border-stone-200 bg-stone-50 p-3">
        <p className="font-medium text-stone-700">Aanbetaling</p>
        <p className="text-stone-600">
          {currency.format(schedule.depositAmount)} — vóór{" "}
          {fmtDate(schedule.depositDeadline)}
        </p>
      </div>
      <div className="rounded border border-stone-200 bg-stone-50 p-3">
        <p className="font-medium text-stone-700">Restbetaling{borgLine}</p>
        <p className="text-stone-600">
          {currency.format(schedule.balanceAmount)} — vóór{" "}
          {fmtDate(schedule.balanceDeadline)}
        </p>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  bookingId,
  guestName,
  schedulePreview,
}: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      await confirmBookingAction(bookingId);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Bevestigen</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Boeking bevestigen — {guestName}</DialogTitle>
          <DialogDescription className="sr-only">
            Bevestig de boeking en bekijk het betalingsschema dat naar de gast
            wordt gestuurd.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-stone-600">
            Status wordt ingesteld op <strong>in afwachting</strong>. De datums
            worden geblokkeerd in de exportfeed en er wordt een
            overschrijvingse-mail met onderstaand betalingsschema naar de gast
            verstuurd.
          </p>
          <SchedulePreview {...schedulePreview} />
        </div>
        <DialogFooter>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Annuleren
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={isPending}>
            {isPending ? "Bevestigen…" : "Boeking bevestigen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
