"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { useLocale } from "@/i18n/provider";
import { usePlainTranslations } from "@/i18n/use-messages";

// Renders for an explicit `notFound()` thrown within the public `[locale]` tree.
// It is wrapped by `[locale]/layout.tsx`, so the I18nProvider is available and the
// copy is localized. Genuinely unmatched URLs (e.g. `/nl/typo`) bubble to the
// app-level `global-not-found` instead — see ADR-0011.
export default function LocaleNotFound() {
  const t = usePlainTranslations("errors.notFound");
  const locale = useLocale();

  return (
    <main className="flex flex-col flex-1 items-center justify-center gap-8 p-6 py-12 text-center">
      <div className="space-y-4 max-w-md">
        <p className="text-style-eyebrow-large text-brand-moss">404</p>
        <h1 className="text-style-display-medium">{t("heading")}</h1>
        <p className="text-style-body-large text-muted-foreground">
          {t("body")}
        </p>
      </div>
      <Link href={`/${locale}`} className={buttonVariants()}>
        {t("backHome")}
      </Link>
    </main>
  );
}
