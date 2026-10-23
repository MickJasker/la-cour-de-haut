import { Globe } from "lucide-react";
import { Button } from "../ui/button";
import { LanguageNavFrame, LANGUAGE_LINK_LAYOUT } from "./header-shell";

const LOCALE_CODES = ["FR", "EN", "NL", "DE"];

/**
 * Suspense fallbacks for the header's URL-dependent pieces (see
 * language-switcher.tsx). Each is built from the same frame/layout classes as
 * the live piece, with invisible text in the same line boxes, so the swap
 * doesn't shift the fixed bar. Plain server markup, no hooks; `aria-hidden`
 * keeps the placeholders out of the accessibility tree.
 */

export function LanguageNavSkeleton() {
  return (
    <LanguageNavFrame>
      <div className="flex relative gap-1" aria-hidden>
        {LOCALE_CODES.map((code) => (
          <span key={code} className={LANGUAGE_LINK_LAYOUT}>
            <span className="invisible">{code}</span>
          </span>
        ))}
      </div>
    </LanguageNavFrame>
  );
}

export function MobileLanguageMenuSkeleton() {
  return (
    <Button
      type="button"
      className="md:hidden p-0 aspect-square"
      size="lg"
      aria-hidden
      tabIndex={-1}
    >
      <Globe className="size-8" />
    </Button>
  );
}
