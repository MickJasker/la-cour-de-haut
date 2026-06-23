"use client";
import NextLink from "next/link";
import { useParams } from "next/navigation";
import type { ComponentProps } from "react";

// Drop-in for next-intl's locale-aware Link. Prepends the active [locale] segment
// to internal string hrefs ("/book" -> "/nl/book", "/" -> "/nl"). External or
// object hrefs pass through untouched. Mirrors the manual pattern already used in
// header.tsx's language switcher.
export function Link({ href, ...props }: ComponentProps<typeof NextLink>) {
  const { locale } = useParams<{ locale: string }>();

  const localizedHref =
    typeof href === "string" && href.startsWith("/")
      ? `/${locale}${href === "/" ? "" : href}`
      : href;

  return <NextLink href={localizedHref} {...props} />;
}
