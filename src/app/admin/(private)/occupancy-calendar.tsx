"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addMonths,
  buildCalendarMonth,
  type DaySegment,
  type OccupancyEntry,
  type OccupyingBookingStatus,
} from "@/lib/booking/occupancy-calendar";
import { inclusiveRangeToInterval } from "@/lib/booking/owner-blocks";
import { hasConflict } from "@/lib/booking/availability-utils";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  createOwnerBlockAction,
  updateOwnerBlockLabelAction,
  deleteOwnerBlockAction,
  type BlockActionState,
} from "./block-actions";

const INITIAL_ACTION_STATE: BlockActionState = { success: false, error: null };

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

/**
 * Owner blocks (ADR-0022 decision 7): a diagonal hatch — pattern, not hue —
 * distinguishes "my block" from the flat-grey platform bars, so it stays
 * legible for colorblind owners. Stone tones keep it in the calendar's palette.
 */
const BLOCK_SEGMENT_CLASSES =
  "bg-[repeating-linear-gradient(135deg,#d6d3d1_0px,#d6d3d1_4px,#f5f5f4_4px,#f5f5f4_8px)] text-stone-700 hover:brightness-95";

const WEEKDAY_LABELS = ["ma", "di", "wo", "do", "vr", "za", "zo"];

export type PendingRequest = {
  id: string;
  name: string;
  start: string;
  end: string;
};

function formatMonthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("nl-NL", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** A single YYYY-MM-DD day formatted for display, e.g. "10 jul 2026". */
function formatDay(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** The day before `date`, as a YYYY-MM-DD string (UTC-safe). */
function previousDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Base shape/size classes shared by every segment slice, minus the fill. */
function segmentShapeClasses(isStart: boolean, isEnd: boolean): string {
  return cn(
    "block h-5 text-xs leading-5 truncate",
    isStart ? "rounded-l-full ml-0.5 pl-1.5" : "-ml-px",
    isEnd ? "rounded-r-full mr-0.5 pr-1.5" : "-mr-px",
  );
}

function segmentLabel(entry: OccupancyEntry): string {
  switch (entry.kind) {
    case "booking":
      return entry.name;
    case "ical":
      return entry.sourceName;
    case "block":
      return entry.label ?? "Geblokkeerd";
  }
}

/** Inclusive range label ("10 jul 2026 – 13 jul 2026") from two YYYY-MM-DD days. */
function InclusiveRangeLabel({ from, to }: { from: string; to: string }) {
  return (
    <p className="text-sm font-medium">
      {formatDay(from)} – {formatDay(to)}
    </p>
  );
}

/** The one optional-label input, shared by the create and edit popovers. */
function BlockLabelInput({ defaultValue }: { defaultValue?: string }) {
  return (
    <input
      type="text"
      name="label"
      aria-label="Label (optioneel)"
      defaultValue={defaultValue}
      placeholder="bijv. eigen verblijf"
      className="w-full rounded-md border border-stone-200 px-2 py-1.5 text-sm outline-none focus:border-stone-400"
    />
  );
}

function ActionError({ state }: { state: BlockActionState }) {
  if (!state.error) return null;
  return <p className="text-xs text-red-600">{state.error}</p>;
}

/**
 * Owner blocks render through BlockSegment; Segment only draws booking/iCal
 * slices — the render loop dispatches on `entry.kind` and passes the narrowed
 * entry so this can't silently receive a block.
 */
function Segment({
  segment,
  entry,
}: {
  segment: DaySegment;
  entry: Exclude<OccupancyEntry, { kind: "block" }>;
}) {
  const { isStart, isEnd, showLabel } = segment;

  const className = cn(
    segmentShapeClasses(isStart, isEnd),
    entry.kind === "booking"
      ? BOOKING_SEGMENT_CLASSES[entry.status]
      : ICAL_SEGMENT_CLASSES,
  );

  const label = showLabel ? segmentLabel(entry) : " ";

  if (entry.kind === "booking") {
    return (
      <Link
        href={`/admin/bookings#booking-${entry.id}`}
        className={className}
        title={`${entry.name} · ${entry.start} → ${entry.end}`}
        // A segment click must never start a day selection (ADR-0022).
        onClick={(e) => e.stopPropagation()}
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
      onClick={(e) => e.stopPropagation()}
    >
      {label}
    </span>
  );
}

/**
 * A slice of an owner block: a hatched bar that opens an edit/delete popover
 * (ADR-0022 decision 5). Each slice owns its popover, mirroring how each
 * booking slice is its own link.
 */
function BlockSegment({
  segment,
  entry,
}: {
  segment: DaySegment;
  entry: Extract<OccupancyEntry, { kind: "block" }>;
}) {
  const { isStart, isEnd, showLabel } = segment;
  const [open, setOpen] = useState(false);

  const [saveState, saveAction, isSaving] = useActionState(
    async (_prev: BlockActionState, formData: FormData) => {
      const result = await updateOwnerBlockLabelAction(
        entry.id,
        String(formData.get("label") ?? ""),
      );
      if (result.success) setOpen(false);
      return result;
    },
    INITIAL_ACTION_STATE,
  );

  const [deleteState, deleteAction, isDeleting] = useActionState(
    async (): Promise<BlockActionState> => {
      const result = await deleteOwnerBlockAction(entry.id);
      if (result.success) setOpen(false);
      return result;
    },
    INITIAL_ACTION_STATE,
  );

  const isPending = isSaving || isDeleting;
  const displayLabel = entry.label ?? "Geblokkeerd";
  const lastBlockedDay = previousDay(entry.end);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            segmentShapeClasses(isStart, isEnd),
            BLOCK_SEGMENT_CLASSES,
            // Unlike the booking <a> slices, a <button> at display:block
            // shrinks to fit its content — continuation slices hold only a
            // nbsp, so without an explicit width they collapse to slivers.
            "w-full text-left",
          )}
          // Accessible name carries the label on every slice, even the blank
          // continuation slices, so screen readers announce the block.
          aria-label={displayLabel}
          title={`${displayLabel} · ${entry.start} → ${entry.end}`}
          tabIndex={showLabel ? undefined : -1}
        >
          {showLabel ? displayLabel : " "}
        </button>
      </PopoverTrigger>
      <PopoverContent className="space-y-3">
        <InclusiveRangeLabel from={entry.start} to={lastBlockedDay} />
        <form action={saveAction} className="space-y-2">
          <BlockLabelInput defaultValue={entry.label ?? ""} />
          <ActionError state={saveState} />
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-md bg-stone-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50"
          >
            Opslaan
          </button>
        </form>
        <form action={deleteAction} className="space-y-2">
          <ActionError state={deleteState} />
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Deblokkeren
          </button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/** The create popover shown after a two-click range selection completes. */
function CreateBlockForm({
  selection,
  pendingRequests,
  onDone,
}: {
  selection: { a: string; b: string };
  pendingRequests: PendingRequest[];
  onDone: () => void;
}) {
  const interval = inclusiveRangeToInterval(selection.a, selection.b);
  const from = interval.start;
  const to = previousDay(interval.end);

  const overlapping = pendingRequests.filter((r) =>
    hasConflict([{ start: r.start, end: r.end }], interval.start, interval.end),
  );

  const [state, formAction, isPending] = useActionState(
    async (_prev: BlockActionState, formData: FormData) => {
      const result = await createOwnerBlockAction({
        start: interval.start,
        end: interval.end,
        label: String(formData.get("label") ?? ""),
      });
      if (result.success) onDone();
      return result;
    },
    INITIAL_ACTION_STATE,
  );

  return (
    <div className="space-y-3">
      <InclusiveRangeLabel from={from} to={to} />

      {overlapping.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 space-y-1">
          <p>
            Overlapt{" "}
            {overlapping.length === 1
              ? "een openstaande aanvraag"
              : `${overlapping.length} openstaande aanvragen`}{" "}
            — die kan hierna niet meer worden bevestigd:
          </p>
          <ul className="space-y-0.5">
            {overlapping.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/admin/bookings#booking-${r.id}`}
                  className="underline hover:text-amber-950"
                >
                  {r.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form action={formAction} className="space-y-2">
        <BlockLabelInput />
        <ActionError state={state} />
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-md bg-stone-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50"
        >
          Blokkeren
        </button>
      </form>
    </div>
  );
}

export function OccupancyCalendar({
  entries,
  initialMonth,
  pendingRequests,
}: {
  entries: OccupancyEntry[];
  initialMonth: string;
  pendingRequests: PendingRequest[];
}) {
  const [month, setMonth] = useState(initialMonth);
  // First click of a two-click range select; null once completed or cancelled.
  const [pendingStart, setPendingStart] = useState<string | null>(null);
  // Completed selection (both clicked days); drives the create popover.
  const [selection, setSelection] = useState<{ a: string; b: string } | null>(
    null,
  );

  const weeks = buildCalendarMonth(month, entries);

  function resetSelection() {
    setPendingStart(null);
    setSelection(null);
  }

  function changeMonth(delta: number) {
    setMonth((m) => addMonths(m, delta));
    // A pending selection can't span the month it was started in once the grid
    // moves away, so cancel it (ADR-0022).
    resetSelection();
  }

  function handleDayClick(date: string) {
    if (pendingStart === null) {
      setPendingStart(date);
      return;
    }
    setSelection({ a: pendingStart, b: date });
    setPendingStart(null);
  }

  function inSelectionRange(date: string): boolean {
    if (!selection) return false;
    const lo = selection.a <= selection.b ? selection.a : selection.b;
    const hi = selection.a <= selection.b ? selection.b : selection.a;
    return date >= lo && date <= hi;
  }

  return (
    <Popover
      open={selection !== null}
      onOpenChange={(next) => {
        // Outside click / Escape closes the create popover and clears the
        // whole selection cleanly (ADR-0022).
        if (!next) resetSelection();
      }}
    >
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
              onClick={() => changeMonth(-1)}
              className="rounded-md p-1.5 text-stone-500 hover:bg-stone-100 hover:text-stone-700 transition-colors"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Volgende maand"
              onClick={() => changeMonth(1)}
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
              {week.map((day) => {
                const selected = inSelectionRange(day.date);
                const isPendingStart = pendingStart === day.date;
                const cell = (
                  <div
                    key={day.date}
                    data-date={day.date}
                    onClick={() => handleDayClick(day.date)}
                    className={cn(
                      "min-h-16 py-1 overflow-hidden cursor-pointer",
                      selected && "bg-sky-50",
                      isPendingStart && "ring-2 ring-inset ring-sky-400",
                    )}
                  >
                    <p
                      className={cn(
                        "px-1.5 pb-0.5 text-xs",
                        day.inMonth ? "text-stone-600" : "text-stone-300",
                      )}
                    >
                      {Number(day.date.slice(8))}
                    </p>
                    <div className="space-y-0.5">
                      {day.segments.map((segment) =>
                        segment.entry.kind === "block" ? (
                          <BlockSegment
                            key={segment.key}
                            segment={segment}
                            entry={segment.entry}
                          />
                        ) : (
                          <Segment
                            key={segment.key}
                            segment={segment}
                            entry={segment.entry}
                          />
                        ),
                      )}
                    </div>
                  </div>
                );

                // The second-clicked cell anchors the create popover.
                return selection && selection.b === day.date ? (
                  <PopoverAnchor asChild key={day.date}>
                    {cell}
                  </PopoverAnchor>
                ) : (
                  cell
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {selection && (
        <PopoverContent align="center">
          <CreateBlockForm
            key={`${selection.a}-${selection.b}`}
            selection={selection}
            pendingRequests={pendingRequests}
            onDone={resetSelection}
          />
        </PopoverContent>
      )}
    </Popover>
  );
}
