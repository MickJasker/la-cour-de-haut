"use client";

import { useParams, usePathname } from "next/navigation";
import { ReactNode, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Button } from "../ui/button";
import { Globe } from "lucide-react";

const LOCALES = ["fr", "en", "nl", "de"] as const;

// Matches the pill's `duration-200` transition — how long to let the slide
// play before the hard navigation tears the page down.
const PILL_SLIDE_MS = 200;

const LOCALE_LABEL: Record<string, string> = {
  fr: "Français",
  en: "English",
  nl: "Nederlands",
  de: "Deutsch",
};

export function Header({
  action,
  telephone,
  telephoneDisplay,
  email,
}: {
  action: ReactNode;
  /** E.164 phone for the `tel:` link; empty string renders no phone. */
  telephone: string;
  /** Formatted phone for display. */
  telephoneDisplay: string;
  email: string;
}) {
  const { locale } = useParams<{ locale: string }>();
  const pathname = usePathname();
  const mainEl = useSyncExternalStore(
    () => () => {},
    () => document.querySelector<HTMLElement>("main")?.parentElement,
    () => null,
  );

  // The locale being navigated to, tracked so the pill can slide to its new
  // position while the full-document navigation is in flight.
  const [pendingLocale, setPendingLocale] = useState<string | null>(null);
  const activeLocale = pendingLocale ?? locale;
  const displayIndex = LOCALES.indexOf(
    activeLocale as (typeof LOCALES)[number],
  );

  const switchLocale = (loc: string, href: string) => {
    setPendingLocale(loc);
    // Locale switching is a full document navigation (see LanguageLink), which
    // would cut off the pill slide if it fired immediately. Let the slide play,
    // then hard-navigate.
    window.setTimeout(() => {
      window.location.href = href;
    }, PILL_SLIDE_MS);
  };

  const [isLocaleSwitcherOpen, setIsLocaleSwitcherOpen] = useState(false);

  return (
    <>
      <header className="fixed bottom-0 left-0 w-full bg-olive-900 text-olive-50 z-10 p-6 md:px-0 md:grid md:grid-cols-[24px_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_24px] lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_2fr] gap-4 md:items-center">
        <a
          href={`tel:${telephone}`}
          className="max-lg:hidden md:col-start-2 col-span-3"
        >
          {telephoneDisplay}
        </a>
        <a
          href={`mailto:${email}`}
          className="max-lg:hidden md:col-start-5 col-span-3"
        >
          {email}
        </a>
        <nav
          aria-label="Language"
          className="max-md:hidden md:col-start-2 lg:col-start-8 col-span-3 p-1 rounded-full bg-olive-800 justify-self-start"
        >
          <div className="flex relative gap-1">
            <div
              className="absolute w-10 h-full top-0 left-0 transition-transform ease-in-out duration-200 pointer-events-none"
              style={{
                transform: `translateX(calc(${displayIndex * 100}% + ${displayIndex * 0.25}rem))`,
              }}
            >
              <div className="size-full rounded-full bg-positive" />
            </div>
            {LOCALES.map((loc) => (
              <LanguageLink
                key={loc}
                locale={loc}
                isActive={loc === locale}
                currentPathname={pathname}
                onSwitch={switchLocale}
              />
            ))}
          </div>
        </nav>
        <div className="md:contents flex gap-2">
          {action}
          <Popover
            open={isLocaleSwitcherOpen}
            onOpenChange={setIsLocaleSwitcherOpen}
          >
            <PopoverTrigger asChild>
              <Button
                type="button"
                className="md:hidden p-0 aspect-square"
                size="lg"
                aria-label="Switch language"
              >
                <Globe className="size-8" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-30 p-2">
              <div className="flex flex-col">
                {LOCALES.map((loc) => (
                  <LanguageLink
                    key={loc}
                    locale={loc}
                    isActive={loc === locale}
                    currentPathname={pathname}
                    localeLabel={LOCALE_LABEL[loc]}
                    onSwitch={switchLocale}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </header>
      {mainEl && createPortal(<div className="h-22" />, mainEl)}
    </>
  );
}

function LanguageLink({
  locale,
  isActive,
  currentPathname,
  localeLabel,
  onSwitch,
}: {
  locale: string;
  isActive: boolean;
  currentPathname: string | null;
  localeLabel?: string;
  onSwitch: (locale: string, href: string) => void;
}) {
  // Strip the leading /<currentLocale> segment so we can swap in the new locale
  // e.g. /fr/book → /book, /fr → ""
  const withoutLocale = currentPathname
    ? currentPathname.replace(/^\/[^/]+/, "")
    : "";
  const href = `/${locale}${withoutLocale}`;
  const className =
    "w-10 p-1 text-center rounded-full font-bold relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-olive-800";

  // A real <a href> so a full document navigation is the default: each locale
  // is its own root layout (`[locale]` renders its own <html>/<body> —
  // ADR-0011), so a soft <Link> nav can't swap the root layout and leaves the
  // previous locale's whole tree mounted in a hidden `<Activity>` boundary
  // (duplicate <main>/<header>/<footer> + DOM ids). A hard nav also sidesteps
  // the intercepting-route modal on the standalone /book & /poi pages.
  //
  // On a plain left-click we defer that hard nav briefly so the indicator pill
  // can slide first; modified clicks (new tab, etc.) fall through to the native
  // anchor unchanged.
  return (
    <a
      className={className}
      href={href}
      onClick={(e) => {
        if (
          e.button !== 0 ||
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey
        ) {
          return;
        }
        e.preventDefault();
        onSwitch(locale, href);
      }}
      aria-label={`Switch to ${LOCALE_LABEL[locale]}`}
      aria-current={isActive ? "page" : undefined}
    >
      {localeLabel ?? locale.toUpperCase()}
    </a>
  );
}
