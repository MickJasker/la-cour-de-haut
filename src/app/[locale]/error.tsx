"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { useLocale } from "@/i18n/provider";
import { usePlainTranslations } from "@/i18n/use-messages";

// Catches unexpected runtime errors thrown by public *pages* (e.g. a data-fetch
// failure). It renders inside `[locale]/layout.tsx`, so the I18nProvider is intact
// and we can localize. Failures in the layout itself bubble past this boundary to
// `global-error` (no i18n) — see ADR-0011.
export default function LocaleError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const t = usePlainTranslations("errors.serverError");
  const locale = useLocale();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-col flex-1 items-center justify-center gap-8 p-6 py-12 text-center">
      <div className="space-y-4 max-w-md">
        <h1 className="text-style-display-medium">{t("heading")}</h1>
        <p className="text-style-body-large text-muted-foreground">
          {t("body")}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={() => unstable_retry()}>{t("retry")}</Button>
        <Link
          href={`/${locale}`}
          className={buttonVariants({ variant: "secondary" })}
        >
          {t("backHome")}
        </Link>
      </div>
    </main>
  );
}
