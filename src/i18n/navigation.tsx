"use client";
import NextLink from "next/link";
import { useLocale } from "./provider";
import type { ComponentProps } from "react";

// Drop-in for next-intl's locale-aware Link. Prepends the active [locale] segment
// to internal string hrefs ("/book" -> "/nl/book", "/" -> "/nl"). External or
// object hrefs pass through untouched. Reads the locale from I18nProvider, not the
// URL (`useParams`), so it never blocks prerendering.
export function Link({ href, ...props }: ComponentProps<typeof NextLink>) {
  const locale = useLocale();

  const localizedHref =
    typeof href === "string" && href.startsWith("/")
      ? `/${locale}${href === "/" ? "" : href}`
      : href;

  return <NextLink href={localizedHref} {...props} />;
}
