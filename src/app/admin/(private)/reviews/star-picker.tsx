"use client";

import { useState } from "react";

export function StarPicker({
  value,
  onChange,
  name,
}: {
  value: number;
  onChange: (value: number) => void;
  name?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  const display = hovered ?? value;

  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-0.5" onMouseLeave={() => setHovered(null)}>
        {Array.from({ length: 5 }, (_, i) => {
          const starValue = i + 1;
          const active = starValue <= display;
          return (
            <button
              key={starValue}
              type="button"
              data-testid={`star-${starValue}`}
              aria-label={`${starValue} ster`}
              onMouseEnter={() => setHovered(starValue)}
              onClick={() => onChange(starValue)}
              className={`p-1 rounded transition-transform duration-100 hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active ? "scale-110" : ""
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                className={`w-7 h-7 transition-colors duration-100 ${
                  active
                    ? "fill-amber-400"
                    : "fill-stone-200 hover:fill-amber-200"
                }`}
                aria-hidden
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </button>
          );
        })}
      </div>
      <span className="text-sm text-stone-500 tabular-nums w-12">
        {display} / 5
      </span>
      {name && <input type="hidden" name={name} value={value} />}
    </div>
  );
}
