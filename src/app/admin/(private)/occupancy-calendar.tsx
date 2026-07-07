"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addMonths,
  buildCalendarMonth,
  type DaySegment,
  type OccupancyEntry,
  type OccupyingBookingStatus,
} from "@/lib/booking/occupancy-calendar";
import { cn } from "@/lib/utils";

/**
 * Status → span color for direct bookings on the occupancy calendar (issue
 * #166 spec): amber = on hold, blue = deposit paid, green = confirmed.
 */
const BOOKING_SEGMENT_CLASSES: Record<OccupyingBookingStatus, string> = {
  on_hold: "bg-amber-200 text-amber-900 hover:bg-amber-300",
  deposit_paid: "bg-blue-200 text-blue-900 hover:bg-blue-300",
  confirmed: "bg-green-200 text-green-900 hover:bg-green-300",
};

const ICAL_SEGMENT_CLASSES = "bg-stone-200 text-stone-600";

const WEEKDAY_LABELS = ["ma", "di", "wo", "do", "vr", "za", "zo"];

function formatMonthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("nl-NL", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function segmentLabel(entry: OccupancyEntry): string {
  return entry.kind === "booking" ? entry.name : entry.sourceName;
}

function Segment({ segment }: { segment: DaySegment }) {
  const { entry, isStart, isEnd, showLabel } = segment;

  const className = cn(
    "block h-5 text-xs leading-5 truncate",
    isStart ? "rounded-l-full ml-0.5 pl-1.5" : "-ml-px",
    isEnd ? "rounded-r-full mr-0.5 pr-1.5" : "-mr-px",
    entry.kind === "booking"
      ? BOOKING_SEGMENT_CLASSES[entry.status]
      : ICAL_SEGMENT_CLASSES,
  );

  const label = showLabel ? segmentLabel(entry) : " ";

  if (entry.kind === "booking") {
    return (
      <Link
        href={`/admin/bookings#booking-${entry.id}`}
        className={className}
        title={`${entry.name} · ${entry.start} → ${entry.end}`}
        // One tab stop per labeled slice (start + each week continuation);
        // the unlabeled day slices stay clickable but don't clutter tab order.
        tabIndex={showLabel ? undefined : -1}
      >
        {label}
      </Link>
    );
  }

  return (
    <span
      className={className}
      title={`${entry.sourceName} · ${entry.start} → ${entry.end}`}
    >
      {label}
    </span>
  );
}

export function OccupancyCalendar({
  entries,
  initialMonth,
}: {
  entries: OccupancyEntry[];
  initialMonth: string;
}) {
  const [month, setMonth] = useState(initialMonth);
  const weeks = buildCalendarMonth(month, entries);

  return (
    <div
      data-testid="occupancy-calendar"
      className="rounded-lg border border-stone-200 bg-white"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
        <p className="text-sm font-medium capitalize">
          {formatMonthLabel(month)}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Vorige maand"
            onClick={() => setMonth((m) => addMonths(m, -1))}
            className="rounded-md p-1.5 text-stone-500 hover:bg-stone-100 hover:text-stone-700 transition-colors"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Volgende maand"
            onClick={() => setMonth((m) => addMonths(m, 1))}
            className="rounded-md p-1.5 text-stone-500 hover:bg-stone-100 hover:text-stone-700 transition-colors"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-stone-100">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-1 py-1.5 text-center text-xs font-medium text-stone-400"
          >
            {label}
          </div>
        ))}
      </div>

      <div>
        {weeks.map((week) => (
          <div
            key={week[0].date}
            className="grid grid-cols-7 border-b border-stone-100 last:border-0"
          >
            {week.map((day) => (
              <div key={day.date} className="min-h-16 py-1 overflow-hidden">
                <p
                  className={cn(
                    "px-1.5 pb-0.5 text-xs",
                    day.inMonth ? "text-stone-600" : "text-stone-300",
                  )}
                >
                  {Number(day.date.slice(8))}
                </p>
                <div className="space-y-0.5">
                  {day.segments.map((segment) => (
                    <Segment key={segment.key} segment={segment} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
