import { cn } from "@/lib/utils";
import { Skeleton } from "../ui/skeleton";
import { Separator } from "../ui/separator";

/**
 * Suspense fallback for <BookForm>. Mirrors the form's field layout so the
 * booking dialog / page shows its predictable shape immediately instead of a
 * spinner, and the real form swaps in with no layout shift.
 *
 * Heights are derived from the form's real primitives (verified in-browser
 * against the live form, which measures 1166px tall):
 *   - <Input> / combobox trigger: `h-9` (36px)
 *   - stay-dates <Calendar>: `min-h-100` (400px)
 *   - <Button size="lg">: `h-10` (40px)
 *   - FieldGroup gap `gap-7` (28px), field label→control `gap-1` (4px)
 *   - the invisible Turnstile widget reserves ~24px above the submit button
 *
 * Text rows (labels, price lines, notices) are sized via <TextLine>, whose
 * wrapper carries the *real* text utility (font-size + line-height) so its box
 * equals that text's line box exactly — no magic pixel values, and it tracks
 * the type scale if it ever changes. Rendered by both the modal (client) and
 * the standalone /book page (server): plain divs, no hooks. `aria-hidden`
 * keeps the placeholder bars out of the accessibility tree.
 */

// One line of "text" placeholder. `lineClass` sets font-size + line-height, so
// the wrapper's height is that text's line box; the inline-block bar sits in it.
function TextLine({ lineClass, width }: { lineClass: string; width: string }) {
  return (
    <div className={lineClass}>
      <Skeleton className={cn("inline-block h-2.5 align-middle", width)} />
    </div>
  );
}

// Field label line box. <FieldLabel> is `leading-snug` (≈19.3px); the name
// field's plain <Label> is `leading-normal` (≈21px).
function FieldLabelBar({ leading = "leading-snug" }: { leading?: string }) {
  return (
    <TextLine
      lineClass={cn("text-style-eyebrow-small", leading)}
      width="w-28"
    />
  );
}

// Label + input control.
function FieldSkeleton({ labelLeading }: { labelLeading?: string }) {
  return (
    <div className="flex w-full flex-col gap-1">
      <FieldLabelBar leading={labelLeading} />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}

export function BookFormSkeleton() {
  return (
    <div className="w-full max-w-2xl space-y-6" aria-hidden>
      <div className="flex flex-col gap-7">
        {/* Name — uses a plain <Label> (leading-normal), so it's ~2px taller
            than the FieldLabel rows below. */}
        <FieldSkeleton labelLeading="leading-normal" />

        {/* Email + Phone */}
        <div className="grid gap-6 md:grid-cols-2">
          <FieldSkeleton />
          <FieldSkeleton />
        </div>

        {/* Address */}
        <FieldSkeleton />

        {/* Postal code + City */}
        <div className="grid gap-6 md:grid-cols-2">
          <FieldSkeleton />
          <FieldSkeleton />
        </div>

        {/* Country */}
        <FieldSkeleton />

        {/* Guest count (radio) + Stay dates (calendar). The calendar
            (min-h-100 = 400px) sets this row's height, so the radio placeholder
            sizes don't affect the vertical rhythm. */}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <FieldLabelBar />
            <div className="mt-2 grid gap-2">
              <div className="flex items-center gap-2">
                <Skeleton className="size-4 rounded-full" />
                <TextLine lineClass="text-sm" width="w-20" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="size-4 rounded-full" />
                <TextLine lineClass="text-sm" width="w-20" />
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabelBar />
            <Skeleton className="min-h-100 w-full" />
          </div>
        </div>

        <Separator />

        {/* Price breakdown: three flush `text-sm` lines (the middle breakdown
            line is `invisible` in the real form but still holds its row) = 60px,
            no gap between them. */}
        <div>
          <TextLine lineClass="text-md" width="w-48" />
          <TextLine lineClass="text-md" width="w-40" />
          <TextLine lineClass="text-md" width="w-56" />
          <TextLine lineClass="text-md" width="w-48" />
          <TextLine lineClass="text-md" width="w-64" />
        </div>

        {/* Submit block: the invisible Turnstile reserves ~24px above the
            button (h-10), then `gap-6` to the one-line privacy notice. */}
        <div className="flex flex-col">
          <div className="h-6" />
          <Skeleton className="h-10 w-full" />
          <div className="mt-6">
            <TextLine lineClass="text-xs" width="w-3/4" />
          </div>
        </div>
      </div>

      {/* Disclaimer (outside the FieldGroup, under the form's `space-y-6`) —
          two `text-xs` lines at this width. */}
      <div>
        <TextLine lineClass="text-xs" width="w-full" />
        <TextLine lineClass="text-xs" width="w-11/12" />
      </div>
    </div>
  );
}
