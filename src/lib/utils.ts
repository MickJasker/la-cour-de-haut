import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Tailwind v4 @theme custom font-size utilities (text-body-*, text-display-*, etc.)
// are unknown to tailwind-merge, which misclassifies them as text-color utilities and
// evicts text-color classes (e.g. text-cream-50) when combined via cva. Register them
// as fontSize so they only conflict with each other, never with colors.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        "text-display-large",
        "text-display-medium",
        "text-body-large",
        "text-body-medium",
        "text-body-small",
        "text-eyebrow-large",
        "text-eyebrow-medium",
        "text-eyebrow-small",
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
