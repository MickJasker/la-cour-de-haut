"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  ComponentProps,
  ReactNode,
  useOptimistic,
  useSyncExternalStore,
  useTransition,
} from "react";
import { createPortal } from "react-dom";

const LOCALES = ["fr", "en", "nl", "de"] as const;

const LOCALE_LABEL: Record<string, string> = {
  fr: "Français",
  en: "English",
  nl: "Nederlands",
  de: "Deutsch",
};

export function Header({
  action,
  localeSwitchFullReload = false,
}: {
  action: ReactNode;
  // On pages that are the standalone version of an intercepted route
  // (/book, /poi/[slug]), a soft-nav locale switch would be caught by the
  // interceptor and pop the modal. A full reload bypasses interception.
  localeSwitchFullReload?: boolean;
}) {
  const { locale } = useParams<{ locale: string }>();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [optimisticLocale, setOptimisticLocale] = useOptimistic(locale);
  const mainEl = useSyncExternalStore(
    () => () => {},
    () => document.querySelector<HTMLElement>("main"),
    () => null,
  );

  const displayIndex = LOCALES.indexOf(
    optimisticLocale as (typeof LOCALES)[number],
  );

  const switchLocale = (loc: string) => {
    startTransition(async () => {
      setOptimisticLocale(loc);
      await new Promise<void>((resolve) => setTimeout(resolve, 200));
    });
  };

  return (
    <>
      <header className="fixed bottom-0 left-0 w-full bg-olive-900 text-olive-50 z-10 p-6 md:px-0 md:grid md:grid-cols-[24px_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_24px] lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_2fr] gap-4 md:items-center">
        <a
          href="tel:+33673100089"
          className="max-lg:hidden md:col-start-2 col-span-3"
        >
          +33 6 731 00 89
        </a>
        <a
          href="mailto:info@lacourdehaut.fr"
          className="max-lg:hidden md:col-start-5 col-span-3"
        >
          info@lacourdehaut.fr
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
                isActive={loc === optimisticLocale}
                currentPathname={pathname}
                fullReload={localeSwitchFullReload}
                onNavigate={() => switchLocale(loc)}
              />
            ))}
          </div>
        </nav>
        {action}
      </header>
      {mainEl && createPortal(<div className="h-22" />, mainEl)}
    </>
  );
}

function LanguageLink({
  locale,
  isActive,
  currentPathname,
  fullReload,
  onNavigate,
}: {
  locale: string;
  isActive: boolean;
  currentPathname: string | null;
  fullReload: boolean;
  onNavigate: ComponentProps<typeof Link>["onNavigate"];
}) {
  // Strip the leading /<currentLocale> segment so we can swap in the new locale
  // e.g. /fr/book → /book, /fr → ""
  const withoutLocale = currentPathname
    ? currentPathname.replace(/^\/[^/]+/, "")
    : "";
  const href = `/${locale}${withoutLocale}`;
  const className =
    "w-10 p-1 text-center rounded-full font-bold relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-olive-800";

  // A plain anchor does a full document navigation, which leaves the Next
  // router and so is never caught by an intercepting route's modal.
  if (fullReload) {
    return (
      <a
        className={className}
        href={href}
        aria-label={`Switch to ${LOCALE_LABEL[locale]}`}
        aria-current={isActive ? "page" : undefined}
      >
        {locale.toUpperCase()}
      </a>
    );
  }

  return (
    <Link
      className={className}
      href={href}
      scroll={false}
      onNavigate={onNavigate}
      aria-label={`Switch to ${LOCALE_LABEL[locale]}`}
      aria-current={isActive ? "page" : undefined}
    >
      {locale.toUpperCase()}
    </Link>
  );
}
