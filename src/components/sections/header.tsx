"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ComponentProps,
  ReactNode,
  useOptimistic,
  useSyncExternalStore,
  useTransition,
} from "react";
import { createPortal } from "react-dom";

const LOCALES = ["fr", "en", "nl", "de"] as const;

export function Header({ action }: { action: ReactNode }) {
  const { locale } = useParams<{ locale: string }>();
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
        <div className="max-md:hidden md:col-start-2 lg:col-start-8 col-span-3 p-1 rounded-full bg-olive-800 justify-self-start">
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
                onNavigate={() => switchLocale(loc)}
              />
            ))}
          </div>
        </div>
        {action}
      </header>
      {mainEl && createPortal(<div className="h-22" />, mainEl)}
    </>
  );
}

function LanguageLink({
  locale,
  onNavigate,
}: {
  locale: string;
  onNavigate: ComponentProps<typeof Link>["onNavigate"];
}) {
  return (
    <Link
      className="w-10 p-1 text-center rounded-full font-bold relative"
      href={`/${locale}`}
      onNavigate={onNavigate}
    >
      {locale.toUpperCase()}
    </Link>
  );
}
