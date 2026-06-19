"use client";
import { useOptimistic, useTransition } from "react";
import { updateOwnerNotesAction } from "./actions";

export function NotesEditor({
  bookingId,
  initialNotes,
}: {
  bookingId: string;
  initialNotes: string | null;
}) {
  const [notes, setOptimistic] = useOptimistic(initialNotes ?? "");
  const [, startTransition] = useTransition();

  return (
    <textarea
      className="w-full resize-none rounded border border-stone-200 bg-stone-50 px-2 py-1 text-sm text-stone-700 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none"
      rows={2}
      placeholder="Owner notes…"
      defaultValue={notes}
      onBlur={(e) => {
        const value = e.currentTarget.value;
        startTransition(async () => {
          setOptimistic(value);
          await updateOwnerNotesAction(bookingId, value);
        });
      }}
    />
  );
}
