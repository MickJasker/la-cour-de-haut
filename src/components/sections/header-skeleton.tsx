import type { ReactNode } from "react";
import { Globe } from "lucide-react";
import { Button } from "../ui/button";
import {
  HeaderBar,
  LanguageNavFrame,
  LANGUAGE_LINK_LAYOUT,
} from "./header-shell";

const LOCALE_CODES = ["FR", "EN", "NL", "DE"];

/**
 * Suspense fallback for <Header>, which needs `usePathname()` (the locale
 * switcher swaps the current path into each locale's link) and so can't
 * prerender. Everything that doesn't depend on the URL — the contact links and
 * the page's `action` — renders for real; only the language switcher is a
 * placeholder.
 *
 * Built from the same <HeaderBar>/<LanguageNavFrame> as the live header, with
 * invisible text in the same line boxes, so the swap doesn't shift the bar.
 * Plain server markup, no hooks. `aria-hidden` on the placeholders keeps them
 * out of the accessibility tree.
 */
export function HeaderSkeleton({
  action,
  telephone,
  telephoneDisplay,
  email,
}: {
  action: ReactNode;
  telephone: string;
  telephoneDisplay: string;
  email: string;
}) {
  return (
    <HeaderBar
      telephone={telephone}
      telephoneDisplay={telephoneDisplay}
      email={email}
      languageNav={
        <LanguageNavFrame>
          <div className="flex relative gap-1" aria-hidden>
            {LOCALE_CODES.map((code) => (
              <span key={code} className={LANGUAGE_LINK_LAYOUT}>
                <span className="invisible">{code}</span>
              </span>
            ))}
          </div>
        </LanguageNavFrame>
      }
      actions={
        <>
          {action}
          <Button
            type="button"
            className="md:hidden p-0 aspect-square"
            size="lg"
            aria-hidden
            tabIndex={-1}
          >
            <Globe className="size-8" />
          </Button>
        </>
      }
    />
  );
}
