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
import { deleteBookingAction } from "./actions";

const dateFmt = new Intl.DateTimeFormat("nl-NL", {
  year: "numeric",
  month: "long",
  day: "numeric",
});
const fmtDate = (iso: string) => dateFmt.format(new Date(iso));

type Props = {
  bookingId: string;
  guestName: string;
  startDate: string;
  endDate: string;
};

export function DeleteDialog({
  bookingId,
  guestName,
  startDate,
  endDate,
}: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteBookingAction(bookingId);
      if (result.ok) setOpen(false);
      else setError(result.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          Verwijderen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Boeking verwijderen — {guestName}</DialogTitle>
          <DialogDescription className="sr-only">
            Verwijder deze boeking definitief uit het overzicht.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-stone-600">
            De boeking van <strong>{guestName}</strong> ({fmtDate(startDate)} –{" "}
            {fmtDate(endDate)}) en alle bijbehorende gastgegevens worden
            definitief verwijderd. Dit kan niet ongedaan worden gemaakt.
          </p>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
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
          <Button
            size="sm"
            className="bg-red-600 text-white hover:bg-red-700 active:bg-red-800"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending ? "Verwijderen…" : "Definitief verwijderen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
