"use client";

import { useState } from "react";

export function StarPicker({ defaultValue = 5 }: { defaultValue?: number }) {
  const [rating, setRating] = useState(defaultValue);
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="flex gap-1 items-center">
      {Array.from({ length: 5 }, (_, i) => {
        const value = i + 1;
        const active = hovered !== null ? value <= hovered : value <= rating;
        return (
          <button
            key={value}
            type="button"
            data-testid={`star-${value}`}
            aria-label={`${value} ster`}
            onMouseEnter={() => setHovered(value)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => setRating(value)}
            className="p-0.5"
          >
            <svg
              viewBox="0 0 16 16"
              className={`w-6 h-6 transition-colors ${active ? "fill-amber-400" : "fill-stone-200"}`}
              aria-hidden
            >
              <path d="M8 1l2.06 4.18L15 6.27l-3.5 3.41.83 4.82L8 12.1l-4.33 2.4.83-4.82L1 6.27l4.94-.09z" />
            </svg>
          </button>
        );
      })}
      <input type="hidden" name="rating" value={rating} />
    </div>
  );
}
