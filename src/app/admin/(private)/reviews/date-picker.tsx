"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function DatePicker({
  name,
  defaultValue,
}: {
  name: string;
  defaultValue?: string;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Date | undefined>(
    defaultValue ? new Date(defaultValue + "T00:00:00") : undefined,
  );

  const formatted = selected ? format(selected, "d MMMM yyyy") : null;
  const isoValue = selected ? format(selected, "yyyy-MM-dd") : "";

  return (
    <>
      <input type="hidden" name={name} value={isoValue} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex h-9 w-full items-center gap-2 rounded-lg border border-input bg-cream-50 px-3 text-sm",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              !selected && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="size-4 shrink-0 text-stone-400" />
            {formatted ?? "Pick a date"}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(date) => {
              setSelected(date);
              setOpen(false);
            }}
            captionLayout="dropdown"
            defaultMonth={selected}
          />
        </PopoverContent>
      </Popover>
    </>
  );
}
