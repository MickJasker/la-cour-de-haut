"use client";

import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Renders a review's quote clamped to 3 lines, with a "Lees meer" toggle that
 * appears only when the text actually overflows the clamp (measured, not a
 * character-count heuristic — the same review differs in length per locale
 * and viewport width).
 *
 * Measurement uses a ref callback that returns a cleanup function (React 19)
 * rather than a `useEffect`, wiring a `ResizeObserver` on the blockquote so
 * the overflow check re-runs on viewport/font/content changes. The callback
 * is memoized on `expanded` (not `[]`) so React tears down and reattaches it
 * whenever the clamp toggles, instead of reaching for a mutable ref.
 */
export function ReviewQuote({
  body,
  expandLabel,
  collapseLabel,
}: {
  body: string;
  expandLabel: string;
  collapseLabel: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  const measureRef = useCallback(
    (node: HTMLQuoteElement | null) => {
      // While expanded the clamp class is removed, so clientHeight would grow
      // to match scrollHeight — that would (wrongly) read as "no overflow"
      // and hide the collapse control. Skip measuring entirely while
      // expanded; the `overflowing` flag it produced already told us the
      // control is needed, and re-measuring resumes once collapsed again.
      if (!node || expanded) return;

      const measure = () => {
        setOverflowing(node.scrollHeight > node.clientHeight + 1);
      };

      measure();
      const observer = new ResizeObserver(measure);
      observer.observe(node);
      return () => observer.disconnect();
    },
    [expanded],
  );

  // `flex-1` lives on the wrapper, not the blockquote: cards in a grid row
  // stretch to equal height, and a stretched clamped element clips at its
  // grown box height instead of at 3 lines — the ellipsis lands mid-text
  // with more lines visible below it. The wrapper absorbs the stretch so the
  // clamp (and the clientHeight measurement) stays at its natural height.
  return (
    <div className="flex flex-1 flex-col">
      <blockquote
        ref={measureRef}
        className={cn(
          "text-stone-700 font-display italic",
          !expanded && "line-clamp-3",
        )}
      >
        &ldquo;{body}&rdquo;
      </blockquote>
      {overflowing && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-2 self-start text-sm text-stone-600 underline underline-offset-2 transition-colors hover:text-stone-900"
          aria-expanded={expanded}
        >
          {expanded ? collapseLabel : expandLabel}
        </button>
      )}
    </div>
  );
}
